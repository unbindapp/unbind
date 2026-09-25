package variables_service

import (
	"context"
	"fmt"
	"net"
	"slices"
	"sort"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	"github.com/unbindapp/unbind-api/internal/models"
	service_repo "github.com/unbindapp/unbind-api/internal/repositories/service"
	"github.com/unbindapp/unbind-api/internal/vartemplate"
	"github.com/unbindapp/unbind-api/pkg/databases"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/client-go/kubernetes"
)

type RenderedVariable struct {
	Name       string
	Value      string
	Rendered   string
	References []models.VariableReferenceInfo
}

// RenderResult holds the rendered form of every variable that contains a reference
type RenderResult struct {
	Env        map[string]string
	Variables  map[string]*RenderedVariable
	Unresolved map[string][]vartemplate.Token
}

// EnvVars returns the rendered variables as pod env entries, sorted for stable CRDs
func (self *RenderResult) EnvVars() []corev1.EnvVar {
	envVars := make([]corev1.EnvVar, 0, len(self.Env))
	for name, value := range self.Env {
		envVars = append(envVars, corev1.EnvVar{Name: name, Value: value})
	}
	sort.Slice(envVars, func(i, j int) bool { return envVars[i].Name < envVars[j].Name })
	return envVars
}

func (self *RenderResult) FullyResolved() bool {
	return len(self.Unresolved) == 0
}

// RenderServiceVariables renders the references in a service's variables. Tokens
// that cannot be resolved are left as literal text and reported in Unresolved.
func (self *VariablesService) RenderServiceVariables(ctx context.Context, serviceID uuid.UUID) (*RenderResult, error) {
	service, err := self.repo.Service().GetByID(ctx, serviceID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Service not found")
		}
		return nil, err
	}

	client := self.k8s.GetInternalClient()
	values, err := self.k8s.GetSecretMap(ctx, service.KubernetesSecret, serviceNamespace(service), client)
	if err != nil {
		return nil, err
	}

	return self.renderVariables(ctx, client, service, values)
}

func (self *VariablesService) renderVariables(ctx context.Context, client kubernetes.Interface, service *ent.Service, values map[string][]byte) (*RenderResult, error) {
	result := &RenderResult{
		Env:        make(map[string]string),
		Variables:  make(map[string]*RenderedVariable),
		Unresolved: make(map[string][]vartemplate.Token),
	}

	templated := make(map[string]string)
	var tokens []vartemplate.Token
	for name, raw := range values {
		value := string(raw)
		if !vartemplate.HasTokens(value) {
			continue
		}
		templated[name] = value
		tokens = append(tokens, vartemplate.Parse(value)...)
	}
	if len(templated) == 0 {
		return result, nil
	}

	rc, err := self.newRenderContext(ctx, client, service, tokens)
	if err != nil {
		return nil, err
	}

	for name, value := range templated {
		rendered, unresolved := vartemplate.Render(value, rc.resolve)
		result.Env[name] = rendered
		if len(unresolved) > 0 {
			result.Unresolved[name] = unresolved
		}
		result.Variables[name] = &RenderedVariable{
			Name:       name,
			Value:      value,
			Rendered:   rendered,
			References: rc.referenceInfos(value),
		}
	}

	return result, nil
}

// maxReferenceDepth bounds how far a chain of references is followed. A referenced
// value that is itself a reference is rendered too, and a loop ends here.
const maxReferenceDepth = 8

type renderContext struct {
	ctx          context.Context
	svc          *VariablesService
	client       kubernetes.Interface
	namespace    string
	projectID    uuid.UUID
	scopeNames   map[schema.VariableReferenceSourceType]string
	scopeSecrets map[schema.VariableReferenceSourceType]string
	// Referenced services by ID, nil for one that is missing or outside the project
	services map[uuid.UUID]*ent.Service
	secrets  map[string]map[string][]byte
	// Nil until a public endpoint needs the cluster's own address
	resolvedClusterAddress *string
}

func (self *VariablesService) newRenderContext(ctx context.Context, client kubernetes.Interface, target *ent.Service, tokens []vartemplate.Token) (*renderContext, error) {
	environment := target.Edges.Environment
	if environment == nil || environment.Edges.Project == nil || environment.Edges.Project.Edges.Team == nil {
		return nil, fmt.Errorf("service %s is missing its environment, project or team", target.ID)
	}
	project := environment.Edges.Project
	team := project.Edges.Team

	rc := &renderContext{
		ctx:       ctx,
		svc:       self,
		client:    client,
		namespace: team.Namespace,
		projectID: project.ID,
		scopeNames: map[schema.VariableReferenceSourceType]string{
			schema.VariableReferenceSourceTypeTeam:        team.Name,
			schema.VariableReferenceSourceTypeProject:     project.Name,
			schema.VariableReferenceSourceTypeEnvironment: environment.Name,
		},
		scopeSecrets: map[schema.VariableReferenceSourceType]string{
			schema.VariableReferenceSourceTypeTeam:        team.KubernetesSecret,
			schema.VariableReferenceSourceTypeProject:     project.KubernetesSecret,
			schema.VariableReferenceSourceTypeEnvironment: environment.KubernetesSecret,
		},
		services: make(map[uuid.UUID]*ent.Service),
		secrets:  make(map[string]map[string][]byte),
	}

	var serviceIDs []uuid.UUID
	seen := make(map[uuid.UUID]struct{})
	for _, token := range tokens {
		if token.SourceType != schema.VariableReferenceSourceTypeService {
			continue
		}
		if _, ok := seen[token.SourceID]; ok {
			continue
		}
		seen[token.SourceID] = struct{}{}
		serviceIDs = append(serviceIDs, token.SourceID)
	}
	if len(serviceIDs) == 0 {
		return rc, nil
	}
	slices.SortFunc(serviceIDs, func(a, b uuid.UUID) int { return strings.Compare(a.String(), b.String()) })

	sources, err := self.repo.Service().GetByIDs(ctx, serviceIDs)
	if err != nil {
		return nil, err
	}
	for _, id := range serviceIDs {
		rc.services[id] = nil
	}
	for _, source := range sources {
		if rc.inProject(source) {
			rc.services[source.ID] = source
		}
	}

	return rc, nil
}

func (rc *renderContext) inProject(source *ent.Service) bool {
	return source.Edges.Environment != nil && source.Edges.Environment.ProjectID == rc.projectID
}

// service returns a referenced service. One that only a nested reference names is
// loaded on first use, and a miss is remembered so it is not looked up again.
func (rc *renderContext) service(id uuid.UUID) (*ent.Service, bool) {
	if source, ok := rc.services[id]; ok {
		return source, source != nil
	}
	rc.services[id] = nil
	sources, err := rc.svc.repo.Service().GetByIDs(rc.ctx, []uuid.UUID{id})
	if err != nil {
		log.Warnf("Failed to load service %s while rendering variables: %v", id, err)
		return nil, false
	}
	for _, source := range sources {
		if source.ID == id && rc.inProject(source) {
			rc.services[id] = source
			return source, true
		}
	}
	return nil, false
}

func (rc *renderContext) secret(name string) map[string][]byte {
	if data, ok := rc.secrets[name]; ok {
		return data
	}
	data, err := rc.svc.k8s.GetSecretMap(rc.ctx, name, rc.namespace, rc.client)
	if err != nil {
		if !errors.IsNotFound(err) {
			log.Warnf("Failed to read secret %s while rendering variables: %v", name, err)
		}
		data = map[string][]byte{}
	}
	rc.secrets[name] = data
	return data
}

func (rc *renderContext) resolve(token vartemplate.Token) (string, bool) {
	return rc.resolveAt(token, 0)
}

func (rc *renderContext) resolveAt(token vartemplate.Token, depth int) (string, bool) {
	if depth > maxReferenceDepth {
		return "", false
	}
	if token.SourceType != schema.VariableReferenceSourceTypeService {
		secretName, ok := rc.scopeSecrets[token.SourceType]
		if !ok || secretName == "" {
			return "", false
		}
		value, ok := rc.secret(secretName)[token.Key]
		if !ok {
			return "", false
		}
		return rc.renderNested(string(value), depth)
	}

	source, ok := rc.service(token.SourceID)
	if !ok {
		return "", false
	}
	if isProvidedKey(token.Key) {
		return rc.providedValue(source, token.Key)
	}
	if value, ok := rc.secret(source.KubernetesSecret)[token.Key]; ok {
		return rc.renderNested(string(value), depth)
	}
	if replacement := LegacyDatabaseKey(source, token.Key); replacement != "" {
		return rc.providedValue(source, replacement)
	}
	return "", false
}

// renderNested renders the references inside a referenced value. One that cannot be
// resolved leaves the whole reference unresolved instead of leaking a raw token.
func (rc *renderContext) renderNested(value string, depth int) (string, bool) {
	if !vartemplate.HasTokens(value) {
		return value, true
	}
	rendered, unresolved := vartemplate.Render(value, func(token vartemplate.Token) (string, bool) {
		return rc.resolveAt(token, depth+1)
	})
	return rendered, len(unresolved) == 0
}

func (rc *renderContext) endpointValue(source *ent.Service, key string) (string, bool) {
	ref, ok := vartemplate.ParseEndpointKey(key)
	if !ok {
		return "", false
	}

	switch ref.Base {
	case vartemplate.KeyHostPrivate, vartemplate.KeyPortPrivate, vartemplate.KeyURLPrivate, vartemplate.KeyDatabaseURLPrivate:
		endpoint, ok := selectEndpoint(rc.privateEndpoints(source), ref)
		if !ok {
			return "", false
		}
		return rc.addressValue(source, ref.Base, endpoint, false)
	case vartemplate.KeyHostPublic, vartemplate.KeyPortPublic, vartemplate.KeyURLPublic, vartemplate.KeyDatabaseURLPublic:
		endpoint, ok := selectEndpoint(publicEndpoints(source, rc.clusterAddress), ref)
		if !ok {
			return "", false
		}
		return rc.addressValue(source, ref.Base, endpoint, true)
	}
	return "", false
}

// addressValue turns one endpoint into the value the key asks for
func (rc *renderContext) addressValue(source *ent.Service, base string, endpoint serviceEndpoint, public bool) (string, bool) {
	switch base {
	case vartemplate.KeyHostPrivate, vartemplate.KeyHostPublic:
		return endpoint.Host, true
	case vartemplate.KeyPortPrivate, vartemplate.KeyPortPublic:
		return strconv.Itoa(int(endpoint.Port)), true
	case vartemplate.KeyURLPrivate:
		if isDatabase(source) {
			return "", false
		}
		return fmt.Sprintf("http://%s", net.JoinHostPort(endpoint.Host, strconv.Itoa(int(endpoint.Port)))), true
	case vartemplate.KeyURLPublic:
		if isDatabase(source) {
			return "", false
		}
		// Raw L4 has no scheme to speak of, so the address stands on its own
		if endpoint.L4 {
			return net.JoinHostPort(endpoint.Host, strconv.Itoa(int(endpoint.Port))), true
		}
		return fmt.Sprintf("https://%s", endpoint.Host), true
	case vartemplate.KeyDatabaseURLPrivate, vartemplate.KeyDatabaseURLPublic:
		if !isDatabase(source) {
			return "", false
		}
		return rc.databaseURL(source, endpoint)
	}
	return "", false
}

// databaseURL builds the engine's connection string against one endpoint, picking
// the HTTP protocol when the endpoint fronts the engine's HTTP port
func (rc *renderContext) databaseURL(source *ent.Service, endpoint serviceEndpoint) (string, bool) {
	conn := databaseConnection(source, rc.secret(source.KubernetesSecret))
	conn.Host = endpoint.Host
	conn.Port = endpoint.Port

	url := databases.ConnectionString(conn)
	if endpoint.Label == databases.LabelHTTP {
		url = databases.HTTPConnectionString(conn)
	}
	if url == "" {
		return "", false
	}
	return url, true
}

// Databases created before ports were tracked on the config have none, so fall back
// to the port the engine answers on
func (rc *renderContext) privateEndpoints(source *ent.Service) []serviceEndpoint {
	endpoints := privateEndpoints(source, rc.namespace)
	if len(endpoints) > 0 || source.Type != schema.ServiceTypeDatabase {
		return endpoints
	}
	dbType := databaseType(source)
	port := databases.DefaultPort(dbType)
	if port == 0 {
		return nil
	}
	host := utils.ServiceFQDN(utils.InternalServiceName(dbType, source.KubernetesName), rc.namespace)
	return []serviceEndpoint{{Host: host, IsDomain: true, Port: port, Target: port}}
}

// clusterAddress resolves the node or load balancer address once per render
func (rc *renderContext) clusterAddress() string {
	if rc.resolvedClusterAddress == nil {
		address := ClusterAddress(rc.ctx, rc.svc.k8s)
		rc.resolvedClusterAddress = &address
	}
	return *rc.resolvedClusterAddress
}

func (rc *renderContext) referenceInfos(value string) []models.VariableReferenceInfo {
	tokens := vartemplate.Parse(value)
	infos := make([]models.VariableReferenceInfo, 0, len(tokens))
	for _, token := range tokens {
		info := models.VariableReferenceInfo{
			Token:      token.Raw,
			SourceType: token.SourceType,
			SourceID:   token.SourceID,
			Key:        token.Key,
		}
		if value, ok := rc.resolve(token); ok {
			info.Resolved = true
			info.ResolvedValue = &value
		}

		if token.SourceType != schema.VariableReferenceSourceTypeService {
			info.SourceName = rc.scopeNames[token.SourceType]
			info.SourceIcon = string(token.SourceType)
		} else if source, ok := rc.service(token.SourceID); ok {
			info.SourceName = source.Name
			info.SourceIcon = serviceIcon(source)
		}
		infos = append(infos, info)
	}
	return infos
}

// Services are not always loaded with the whole chain, so callers that need a real
// namespace pass the team's; this is the best effort for the ones that do have it
func serviceNamespace(service *ent.Service) string {
	environment := service.Edges.Environment
	if environment == nil || environment.Edges.Project == nil || environment.Edges.Project.Edges.Team == nil {
		return ""
	}
	return environment.Edges.Project.Edges.Team.Namespace
}

func databaseType(service *ent.Service) string {
	if service.Type != schema.ServiceTypeDatabase || service.Database == nil {
		return ""
	}
	return *service.Database
}

func serviceIcon(service *ent.Service) string {
	if service.Edges.ServiceConfig != nil && service.Edges.ServiceConfig.Icon != "" {
		return service.Edges.ServiceConfig.Icon
	}
	return string(service.Type)
}

// Internal TCP ports, in config order. Node ports are external-only except for databases.
func configInternalPorts(serviceType schema.ServiceType, config *ent.ServiceConfig) []int32 {
	if config == nil {
		return nil
	}
	var ports []int32
	for _, port := range config.Ports {
		if port.Protocol != nil && *port.Protocol == schema.ProtocolUDP {
			continue
		}
		if port.IsNodePort && serviceType != schema.ServiceTypeDatabase {
			continue
		}
		ports = append(ports, port.Port)
	}
	return ports
}

// FindReferencingServices returns deployed services whose variables reference any of
// the given keys on the source
func (self *VariablesService) FindReferencingServices(ctx context.Context, sourceType schema.VariableReferenceSourceType, sourceID uuid.UUID, keys []string) ([]*ent.Service, error) {
	if len(keys) == 0 {
		return nil, nil
	}

	scope, scopeID := sourceType, sourceID
	if sourceType == schema.VariableReferenceSourceTypeService {
		source, err := self.repo.Service().GetByID(ctx, sourceID)
		if err != nil {
			return nil, err
		}
		scope, scopeID = schema.VariableReferenceSourceTypeProject, source.Edges.Environment.ProjectID
		// Nobody references a credential directly, they reference what it builds
		keys = slices.Concat(keys, DerivedEndpointKeys(source, keys))
	}

	candidates, err := self.repo.Service().GetByScope(ctx, scope, scopeID)
	if err != nil {
		return nil, err
	}

	keySet := make(map[string]struct{}, len(keys))
	for _, key := range keys {
		keySet[key] = struct{}{}
	}

	client := self.k8s.GetInternalClient()
	var referencing []*ent.Service
	for _, candidate := range candidates {
		if candidate.ID == sourceID || !service_repo.HasActiveDeployment(candidate) {
			continue
		}
		values, err := self.k8s.GetSecretMap(ctx, candidate.KubernetesSecret, serviceNamespace(candidate), client)
		if err != nil {
			log.Warnf("Failed to read variables of service %s: %v", candidate.ID, err)
			continue
		}
		if referencesAnyKey(values, sourceType, sourceID, keySet) {
			referencing = append(referencing, candidate)
		}
	}

	return referencing, nil
}

func referencesAnyKey(values map[string][]byte, sourceType schema.VariableReferenceSourceType, sourceID uuid.UUID, keys map[string]struct{}) bool {
	for _, raw := range values {
		for _, token := range vartemplate.Parse(string(raw)) {
			if token.SourceType != sourceType {
				continue
			}
			if sourceType == schema.VariableReferenceSourceTypeService && token.SourceID != sourceID {
				continue
			}
			if _, ok := keys[token.Key]; ok {
				return true
			}
		}
	}
	return false
}
