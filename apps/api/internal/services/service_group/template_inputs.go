package servicegroup_service

import (
	"context"
	"fmt"
	"maps"
	"slices"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	"github.com/unbindapp/unbind-api/internal/models"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
	service_repo "github.com/unbindapp/unbind-api/internal/repositories/service"
)

type fanoutTarget struct {
	service *ent.Service
	name    string
	gen     *schema.ValueGenerator
}

type resolvedInput struct {
	state    *models.DeployedTemplateInput
	hostSvc  *ent.Service
	hostSpec schema.HostSpec
	sizeKind string // "volume" | "database"
	pvc      *models.PVCInfo
	fanout   []fanoutTarget
}

type templateInputContext struct {
	template *ent.Template
	services []*ent.Service
	resolved []*resolvedInput
}

// GetTemplateInputs returns the deployed template's inputs, in definition order, with current values.
func (self *ServiceGroupService) GetTemplateInputs(ctx context.Context, requesterUserID uuid.UUID, bearerToken string, input *models.GetServiceGroupInput) (*models.ServiceGroupTemplateInputsResponse, error) {
	tc, err := self.loadTemplateInputContext(ctx, requesterUserID, bearerToken, schema.ActionViewer, input.TeamID, input.ProjectID, input.EnvironmentID, input.ID)
	if err != nil {
		return nil, err
	}

	resp := &models.ServiceGroupTemplateInputsResponse{
		ServiceGroupID: input.ID,
		TemplateID:     new(tc.template.ID),
		Version:        tc.template.Version,
		Inputs:         make([]*models.DeployedTemplateInput, 0, len(tc.resolved)),
	}
	for _, r := range tc.resolved {
		resp.Inputs = append(resp.Inputs, r.state)
	}
	return resp, nil
}

// loadTemplateInputContext gates the group as a template instance and resolves every input to its
// current value and target resource(s).
func (self *ServiceGroupService) loadTemplateInputContext(ctx context.Context, requesterUserID uuid.UUID, bearerToken string, action schema.PermittedAction, teamID, projectID, environmentID, groupID uuid.UUID) (*templateInputContext, error) {
	if err := self.repo.Permissions().Check(ctx, requesterUserID, []permissions_repo.PermissionCheck{
		{Action: action, ResourceType: schema.ResourceTypeEnvironment, ResourceID: environmentID},
	}); err != nil {
		return nil, err
	}

	environment, project, err := self.VerifyInputs(ctx, teamID, projectID, environmentID)
	if err != nil {
		return nil, err
	}

	grp, err := self.repo.ServiceGroup().GetByID(ctx, groupID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Service group not found")
		}
		return nil, err
	}
	if grp.EnvironmentID != environment.ID {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Service group not found")
	}

	services, err := self.repo.ServiceGroup().GetServicesWithDetails(ctx, groupID)
	if err != nil {
		return nil, err
	}

	var template *ent.Template
	for _, svc := range services {
		if svc.Edges.Template != nil {
			template = svc.Edges.Template
			break
		}
	}
	if template == nil {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Service group is not a template instance")
	}

	client, err := self.k8s.CreateClientWithToken(bearerToken)
	if err != nil {
		return nil, err
	}

	volumesByService, err := self.serviceService.GetVolumesForServices(ctx, project.Edges.Team.Namespace, teamID, services)
	if err != nil {
		return nil, err
	}

	secretsByService := make(map[uuid.UUID]map[string][]byte)
	for _, svc := range services {
		if svc.KubernetesSecret == "" {
			continue
		}
		m, err := self.k8s.GetSecretMap(ctx, svc.KubernetesSecret, project.Edges.Team.Namespace, client)
		if err != nil {
			return nil, err
		}
		secretsByService[svc.ID] = m
	}

	resolved := resolveInputs(template.Definition, services, secretsByService, volumesByService)
	return &templateInputContext{template: template, services: services, resolved: resolved}, nil
}

// newDeployedInput flattens a template input into the response shape, adding numeric GB for size inputs.
func newDeployedInput(in schema.TemplateInput) *models.DeployedTemplateInput {
	state := &models.DeployedTemplateInput{
		ID:           in.ID,
		Name:         in.Name,
		Type:         in.Type,
		PortProtocol: in.PortProtocol,
		Description:  in.Description,
		Default:      in.Default,
		Required:     in.Required,
		Hidden:       in.Hidden,
		TargetPort:   in.TargetPort,
	}
	if in.Volume != nil {
		state.Volume = &models.DeployedTemplateVolume{
			Name:      in.Volume.Name,
			MountPath: in.Volume.MountPath,
		}
	}
	if in.Default != nil && (in.Type == schema.InputTypeVolumeSize || in.Type == schema.InputTypeDatabaseSize) {
		if gb, err := parseSizeGB(*in.Default); err == nil {
			state.DefaultGB = new(gb)
		}
	}
	return state
}

func resolveInputs(def schema.TemplateDefinition, services []*ent.Service, secretsByService map[uuid.UUID]map[string][]byte, volumesByService map[uuid.UUID][]*models.PVCInfo) []*resolvedInput {
	serviceByName := make(map[string]*ent.Service, len(services))
	for _, svc := range services {
		serviceByName[svc.Name] = svc
	}

	// Generator-input fan-out: input id -> variables (incl. the variable input itself) derived from it.
	fanout := make(map[string][]fanoutTarget)
	for _, tsvc := range def.Services {
		owner := serviceByName[tsvc.Name]
		if owner == nil {
			continue
		}
		for i := range tsvc.Variables {
			v := tsvc.Variables[i]
			if v.Generator != nil && v.Generator.Type == schema.GeneratorTypeInput {
				fanout[v.Generator.InputID] = append(fanout[v.Generator.InputID], fanoutTarget{service: owner, name: v.Name, gen: v.Generator})
			}
		}
	}

	stringReplaced := stringReplacedInputs(def)

	resolved := make([]*resolvedInput, 0, len(def.Inputs))
	for _, in := range def.Inputs {
		r := &resolvedInput{
			state:  newDeployedInput(in),
			fanout: fanout[in.ID],
		}

		switch in.Type {
		case schema.InputTypeHost:
			if svc, hs := findHostByInput(services, in.ID); svc != nil {
				r.hostSvc = svc
				r.hostSpec = hs
				r.state.ServiceID = new(svc.ID)
				r.state.CurrentValue = hs.Host
				r.state.Editable = true
			}
		case schema.InputTypeVariable:
			if in.Hidden {
				break
			}
			if svc, name := findVarByInput(services, in.ID); svc != nil {
				r.state.ServiceID = new(svc.ID)
				r.state.CurrentValue = string(secretsByService[svc.ID][name])
				r.state.Editable = true
			}
		case schema.InputTypeVolumeSize:
			svc := ownerForInput(def, serviceByName, in.ID)
			if svc == nil || in.Volume == nil {
				break
			}
			pvc := findPVCByMount(volumesByService[svc.ID], in.Volume.MountPath)
			if pvc == nil {
				break
			}
			r.sizeKind = "volume"
			r.pvc = pvc
			r.state.ServiceID = new(svc.ID)
			r.state.CurrentValue = strconv.FormatFloat(pvc.CapacityGB, 'f', -1, 64)
			r.state.CurrentValueGB = new(pvc.CapacityGB)
			r.state.Editable = true
		case schema.InputTypeDatabaseSize:
			svc := ownerForInput(def, serviceByName, in.ID)
			if svc == nil {
				break
			}
			r.sizeKind = "database"
			r.pvc = findDatabasePVC(volumesByService[svc.ID])
			r.state.ServiceID = new(svc.ID)
			r.state.Editable = r.pvc != nil
			cfg := svc.Edges.ServiceConfig
			if cfg == nil || cfg.DatabaseConfig == nil {
				break
			}
			// Use the configured size (desired) rather than the PVC capacity, which lags during resize.
			if gb, err := parseSizeGB(cfg.DatabaseConfig.StorageSize); err == nil {
				r.state.CurrentValue = strconv.FormatFloat(gb, 'f', -1, 64)
				r.state.CurrentValueGB = new(gb)
			}
		}

		// Inputs baked into other config via string-replace can't be safely recomputed without the full input set.
		if r.state.Editable && stringReplaced[in.ID] {
			r.state.Editable = false
			r.state.EditableReason = new("value is embedded in other configuration and cannot be edited individually")
		}
		if !r.state.Editable && r.state.EditableReason == nil && r.state.ServiceID == nil {
			switch in.Type {
			case schema.InputTypeHost, schema.InputTypeVariable, schema.InputTypeVolumeSize, schema.InputTypeDatabaseSize:
				r.state.EditableReason = new("no matching resource found")
			}
		}

		resolved = append(resolved, r)
	}

	resolved = append(resolved, displayVariables(def, serviceByName, secretsByService)...)
	return resolved
}

// displayVariables surfaces annotated generated variables (e.g. admin keys) as read-only login hints.
func displayVariables(def schema.TemplateDefinition, serviceByName map[string]*ent.Service, secretsByService map[uuid.UUID]map[string][]byte) []*resolvedInput {
	var out []*resolvedInput
	for _, tsvc := range def.Services {
		svc := serviceByName[tsvc.Name]
		if svc == nil || svc.Edges.ServiceConfig == nil {
			continue
		}
		secrets := secretsByService[svc.ID]
		for _, name := range slices.Sorted(maps.Keys(svc.Edges.ServiceConfig.VariableMetadata)) {
			meta := svc.Edges.ServiceConfig.VariableMetadata[name]
			value, ok := secrets[name]
			if meta.TemplateInputID != nil || !ok {
				continue
			}
			displayName := meta.DisplayName
			if displayName == "" {
				displayName = name
			}
			out = append(out, &resolvedInput{state: &models.DeployedTemplateInput{
				ID:             name,
				Name:           displayName,
				Type:           schema.InputTypeVariable,
				Description:    meta.Description,
				ServiceID:      new(svc.ID),
				CurrentValue:   string(value),
				Editable:       false,
				EditableReason: new("generated value, shown for reference"),
			}})
		}
	}
	return out
}

// stringReplacedInputs returns the set of input ids whose value is baked into other config via ${ID_VALUE}.
func stringReplacedInputs(def schema.TemplateDefinition) map[string]bool {
	tokens := make(map[string]string, len(def.Inputs))
	for _, in := range def.Inputs {
		tokens[in.ID] = fmt.Sprintf("${%s_VALUE}", strings.ToUpper(in.ID))
	}
	used := make(map[string]bool)
	scan := func(s string) {
		for id, tok := range tokens {
			if strings.Contains(s, tok) {
				used[id] = true
			}
		}
	}
	for _, svc := range def.Services {
		for _, v := range svc.Variables {
			if v.Generator != nil && v.Generator.Type == schema.GeneratorTypeStringReplace {
				scan(v.Value)
			}
		}
		for _, ref := range svc.VariableReferences {
			scan(ref.TemplateString)
		}
		if svc.DatabaseConfig != nil {
			scan(svc.DatabaseConfig.InitDB)
		}
		for _, v := range svc.InitDBReplacers {
			scan(v)
		}
	}
	return used
}

func findHostByInput(services []*ent.Service, inputID string) (*ent.Service, schema.HostSpec) {
	for _, svc := range services {
		if svc.Edges.ServiceConfig == nil {
			continue
		}
		for _, h := range svc.Edges.ServiceConfig.Hosts {
			if h.TemplateInputID != nil && *h.TemplateInputID == inputID {
				return svc, h
			}
		}
	}
	return nil, schema.HostSpec{}
}

func findVarByInput(services []*ent.Service, inputID string) (*ent.Service, string) {
	for _, svc := range services {
		if svc.Edges.ServiceConfig == nil {
			continue
		}
		for name, meta := range svc.Edges.ServiceConfig.VariableMetadata {
			if meta.TemplateInputID != nil && *meta.TemplateInputID == inputID {
				return svc, name
			}
		}
	}
	return nil, ""
}

func ownerForInput(def schema.TemplateDefinition, serviceByName map[string]*ent.Service, inputID string) *ent.Service {
	for _, tsvc := range def.Services {
		if slices.Contains(tsvc.InputIDs, inputID) {
			return serviceByName[tsvc.Name]
		}
	}
	return nil
}

func findPVCByMount(pvcs []*models.PVCInfo, mountPath string) *models.PVCInfo {
	for _, pvc := range pvcs {
		if pvc.MountPath != nil && *pvc.MountPath == mountPath {
			return pvc
		}
	}
	return nil
}

func findDatabasePVC(pvcs []*models.PVCInfo) *models.PVCInfo {
	for _, pvc := range pvcs {
		if pvc.IsDatabase {
			return pvc
		}
	}
	return nil
}

// UpdateTemplateInputs applies edits to a deployed template's inputs, re-projecting each to its resources.
func (self *ServiceGroupService) UpdateTemplateInputs(ctx context.Context, requesterUserID uuid.UUID, bearerToken string, input *models.UpdateServiceGroupTemplateInputsInput) (*models.ServiceGroupTemplateInputsResponse, error) {
	tc, err := self.loadTemplateInputContext(ctx, requesterUserID, bearerToken, schema.ActionEditor, input.TeamID, input.ProjectID, input.EnvironmentID, input.ID)
	if err != nil {
		return nil, err
	}

	byID := make(map[string]*resolvedInput, len(tc.resolved))
	for _, r := range tc.resolved {
		byID[r.state.ID] = r
	}

	client, err := self.k8s.CreateClientWithToken(bearerToken)
	if err != nil {
		return nil, err
	}
	_, project, err := self.VerifyInputs(ctx, input.TeamID, input.ProjectID, input.EnvironmentID)
	if err != nil {
		return nil, err
	}
	namespace := project.Edges.Team.Namespace

	serviceByID := make(map[uuid.UUID]*ent.Service, len(tc.services))
	for _, svc := range tc.services {
		serviceByID[svc.ID] = svc
	}

	// Validate everything before mutating anything.
	type hostEdit struct {
		r       *resolvedInput
		newHost string
	}
	type sizeEdit struct {
		r  *resolvedInput
		gb float64
	}
	var hostEdits []hostEdit
	var sizeEdits []sizeEdit
	secretEdits := make(map[uuid.UUID]map[string][]byte)
	addSecret := func(svcID uuid.UUID, name string, value string) {
		if secretEdits[svcID] == nil {
			secretEdits[svcID] = make(map[string][]byte)
		}
		secretEdits[svcID][name] = []byte(value)
	}
	touched := make(map[uuid.UUID]bool)

	for _, edit := range input.Inputs {
		r, ok := byID[edit.ID]
		if !ok {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, fmt.Sprintf("unknown input %q", edit.ID))
		}
		if !r.state.Editable {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, fmt.Sprintf("input %q is not editable", edit.ID))
		}
		if r.state.Required && strings.TrimSpace(edit.Value) == "" {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, fmt.Sprintf("input %q is required", edit.ID))
		}

		switch r.state.Type {
		case schema.InputTypeHost:
			cleaned, err := utils.CleanAndValidateHost(edit.Value)
			if err != nil {
				return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, fmt.Sprintf("invalid host for input %q: %v", edit.ID, err))
			}
			if cleaned != r.hostSpec.Host {
				count, err := self.repo.Service().CountDomainCollisons(ctx, nil, cleaned, new(r.hostSvc.ID))
				if err != nil {
					return nil, err
				}
				if count > 0 {
					return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, fmt.Sprintf("domain %s already in use", cleaned))
				}
			}
			hostEdits = append(hostEdits, hostEdit{r: r, newHost: cleaned})
			touched[r.hostSvc.ID] = true
			for _, f := range r.fanout {
				res, err := f.gen.Generate(map[string]string{edit.ID: cleaned})
				if err != nil {
					return nil, err
				}
				addSecret(f.service.ID, f.name, res.GeneratedValue)
				touched[f.service.ID] = true
			}
		case schema.InputTypeVariable:
			for _, f := range r.fanout {
				res, err := f.gen.Generate(map[string]string{edit.ID: edit.Value})
				if err != nil {
					return nil, err
				}
				addSecret(f.service.ID, f.name, res.GeneratedValue)
				touched[f.service.ID] = true
			}
		case schema.InputTypeVolumeSize, schema.InputTypeDatabaseSize:
			gb, err := parseSizeGB(edit.Value)
			if err != nil {
				return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, fmt.Sprintf("invalid size for input %q: %v", edit.ID, err))
			}
			if gb < r.pvc.CapacityGB {
				return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, fmt.Sprintf("storage cannot be shrunk for input %q", edit.ID))
			}
			sizeEdits = append(sizeEdits, sizeEdit{r: r, gb: gb})
		}
	}

	// Apply host config changes in a transaction.
	if len(hostEdits) > 0 {
		if err := self.repo.WithTx(ctx, func(tx repository.TxInterface) error {
			for _, he := range hostEdits {
				spec := he.r.hostSpec
				prev := spec.Host
				spec.PrevHost = new(prev)
				spec.Host = he.newHost
				if err := self.repo.Service().UpdateConfig(ctx, tx, &service_repo.MutateConfigInput{
					ServiceID:   he.r.hostSvc.ID,
					UpsertHosts: []schema.HostSpec{spec},
				}); err != nil {
					return err
				}
			}
			return nil
		}); err != nil {
			return nil, err
		}
	}

	// Apply secret (variable + fan-out) changes.
	hostServices := make(map[uuid.UUID]bool, len(hostEdits))
	for _, he := range hostEdits {
		hostServices[he.r.hostSvc.ID] = true
	}
	for svcID, values := range secretEdits {
		svc := serviceByID[svcID]
		if svc == nil || svc.KubernetesSecret == "" {
			continue
		}
		if _, err := self.k8s.UpsertSecretValues(ctx, svc.KubernetesSecret, namespace, values, client); err != nil {
			return nil, err
		}
		// Secret changes are invisible to NeedsDeployment; restart pods unless a host change redeploys them.
		if hostServices[svcID] {
			continue
		}
		if err := self.k8s.RollingRestartPodsByLabel(ctx, namespace, schema.VariableReferenceSourceTypeService.KubernetesLabel(), svcID.String(), client); err != nil {
			return nil, err
		}
	}

	// Apply size changes last (irreversible); UpdatePVC handles its own redeploy.
	for _, se := range sizeEdits {
		gb := se.gb
		if _, err := self.storageService.UpdatePVC(ctx, requesterUserID, bearerToken, &models.UpdatePVCInput{
			ID:            se.r.pvc.ID,
			Type:          se.r.pvc.Type,
			TeamID:        input.TeamID,
			ProjectID:     input.ProjectID,
			EnvironmentID: input.EnvironmentID,
			CapacityGB:    &gb,
		}); err != nil {
			return nil, err
		}
	}

	// Re-fetch services so RedeployServices diffs against the just-written config, not the stale cache.
	if len(touched) > 0 {
		redeploy := make([]*ent.Service, 0, len(touched))
		for id := range touched {
			svc, err := self.repo.Service().GetByID(ctx, id)
			if err != nil {
				return nil, err
			}
			redeploy = append(redeploy, svc)
		}
		if _, err := self.serviceService.RedeployServices(ctx, redeploy); err != nil {
			return nil, err
		}
	}

	return self.GetTemplateInputs(ctx, requesterUserID, bearerToken, &models.GetServiceGroupInput{
		ID:            input.ID,
		TeamID:        input.TeamID,
		ProjectID:     input.ProjectID,
		EnvironmentID: input.EnvironmentID,
	})
}

func parseSizeGB(value string) (float64, error) {
	v := strings.TrimSpace(value)
	v = strings.TrimSuffix(v, "Gi")
	v = strings.TrimSuffix(v, "GB")
	v = strings.TrimSpace(v)
	return strconv.ParseFloat(v, 64)
}
