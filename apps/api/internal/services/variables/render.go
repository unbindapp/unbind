package variables_service

import (
	"context"
	"fmt"
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

type renderContext struct {
	ctx          context.Context
	svc          *VariablesService
	client       kubernetes.Interface
	namespace    string
	scopeNames   map[schema.VariableReferenceSourceType]string
	scopeSecrets map[schema.VariableReferenceSourceType]string
	// Referenced services in the same project as the target
	services map[uuid.UUID]*ent.Service
	secrets  map[string]map[string][]byte
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
	slices.SortFunc(serviceIDs, func(a, b uuid.UUID) int { return strings.Compare(a.String(), b.String()) })

	sources, err := self.repo.Service().GetByIDs(ctx, serviceIDs)
	if err != nil {
		return nil, err
	}
	for _, source := range sources {
		if source.Edges.Environment == nil || source.Edges.Environment.ProjectID != project.ID {
			continue
		}
		rc.services[source.ID] = source
	}

	return rc, nil
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
	if token.SourceType != schema.VariableReferenceSourceTypeService {
		secretName, ok := rc.scopeSecrets[token.SourceType]
		if !ok || secretName == "" {
			return "", false
		}
		value, ok := rc.secret(secretName)[token.Key]
		return string(value), ok
	}

	source, ok := rc.services[token.SourceID]
	if !ok {
		return "", false
	}
	if vartemplate.IsEndpointKey(token.Key) {
		return rc.endpointValue(source, token.Key)
	}
	value, ok := rc.secret(source.KubernetesSecret)[token.Key]
	return string(value), ok
}

func (rc *renderContext) endpointValue(source *ent.Service, key string) (string, bool) {
	base, index, ok := vartemplate.ParseEndpointKey(key)
	if !ok {
		return "", false
	}

	switch base {
	case vartemplate.KeyExternalURL:
		hosts := externalHosts(source)
		if index > len(hosts) {
			return "", false
		}
		return fmt.Sprintf("https://%s", hosts[index-1].Host), true
	case vartemplate.KeyInternalHost:
		return rc.internalHost(source), true
	case vartemplate.KeyInternalPort:
		ports := rc.internalPorts(source)
		if index > len(ports) {
			return "", false
		}
		return strconv.Itoa(int(ports[index-1])), true
	case vartemplate.KeyInternalURL:
		ports := rc.internalPorts(source)
		if index > len(ports) {
			return "", false
		}
		return fmt.Sprintf("http://%s:%d", rc.internalHost(source), ports[index-1]), true
	}
	return "", false
}

func (rc *renderContext) internalHost(source *ent.Service) string {
	return utils.ServiceFQDN(utils.InternalServiceName(databaseType(source), source.KubernetesName), rc.namespace)
}

// Databases created before ports were tracked on the config only expose their port through the secret
func (rc *renderContext) internalPorts(source *ent.Service) []int32 {
	ports := internalPortsFromConfig(source)
	if len(ports) > 0 || source.Type != schema.ServiceTypeDatabase {
		return ports
	}
	raw, ok := rc.secret(source.KubernetesSecret)["DATABASE_PORT"]
	if !ok {
		return nil
	}
	port, err := strconv.Atoi(string(raw))
	if err != nil {
		return nil
	}
	return []int32{int32(port)}
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
		} else if source, ok := rc.services[token.SourceID]; ok {
			info.SourceName = source.Name
			info.SourceIcon = serviceIcon(source)
		}
		infos = append(infos, info)
	}
	return infos
}

func serviceNamespace(service *ent.Service) string {
	return service.Edges.Environment.Edges.Project.Edges.Team.Namespace
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

func externalHosts(service *ent.Service) []schema.HostSpec {
	return configHosts(service.Edges.ServiceConfig)
}

func configHosts(config *ent.ServiceConfig) []schema.HostSpec {
	if config == nil {
		return nil
	}
	return config.Hosts
}

func internalPortsFromConfig(service *ent.Service) []int32 {
	return configInternalPorts(service.Type, service.Edges.ServiceConfig)
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
