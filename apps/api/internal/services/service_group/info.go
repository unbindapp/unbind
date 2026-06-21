package servicegroup_service

import (
	"context"
	"math"
	"sort"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/models"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
	"k8s.io/client-go/kubernetes"
)

// GetServiceGroupInfo returns a template-creation-screen style summary of a deployed group,
// aggregating each service's labeled hosts and variables with their current values.
func (self *ServiceGroupService) GetServiceGroupInfo(ctx context.Context, requesterUserID uuid.UUID, bearerToken string, input *models.GetServiceGroupInput) (*models.ServiceGroupInfoResponse, error) {
	permissionChecks := []permissions_repo.PermissionCheck{
		{
			Action:       schema.ActionViewer,
			ResourceType: schema.ResourceTypeEnvironment,
			ResourceID:   input.EnvironmentID,
		},
	}

	if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
		return nil, err
	}

	environment, project, err := self.VerifyInputs(ctx, input.TeamID, input.ProjectID, input.EnvironmentID)
	if err != nil {
		return nil, err
	}

	grp, err := self.repo.ServiceGroup().GetByID(ctx, input.ID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Service group not found")
		}
		return nil, err
	}
	if grp.EnvironmentID != environment.ID {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Service group not found")
	}

	services, err := self.repo.ServiceGroup().GetServicesWithDetails(ctx, input.ID)
	if err != nil {
		return nil, err
	}

	client, err := self.k8s.CreateClientWithToken(bearerToken)
	if err != nil {
		return nil, err
	}

	volumesByService, err := self.serviceService.GetVolumesForServices(ctx, project.Edges.Team.Namespace, input.TeamID, services)
	if err != nil {
		return nil, err
	}

	resp := &models.ServiceGroupInfoResponse{
		ServiceGroup: models.TransformServiceGroupEntity(grp),
		Services:     make([]*models.ServiceGroupServiceInfo, 0, len(services)),
	}

	for _, service := range services {
		if resp.TemplateID == nil && service.TemplateID != nil {
			resp.TemplateID = service.TemplateID
		}

		inputOrder := templateInputOrder(service.Edges.Template)

		volumes := volumesByService[service.ID]
		if volumes == nil {
			volumes = []*models.PVCInfo{}
		}
		info := &models.ServiceGroupServiceInfo{
			ServiceID: service.ID,
			Name:      service.Name,
			Hosts:     []*models.ServiceGroupHostInfo{},
			Variables: []*models.ServiceGroupVariableInfo{},
			Volumes:   volumes,
		}

		config := service.Edges.ServiceConfig
		if config != nil {
			info.Icon = config.Icon
			info.Hosts = hostInfos(config.Hosts, inputOrder)
			info.Variables, err = self.variableInfos(ctx, client, project.Edges.Team.Namespace, service, config.VariableMetadata, inputOrder)
			if err != nil {
				return nil, err
			}
		}

		resp.Services = append(resp.Services, info)
	}

	return resp, nil
}

// templateInputOrder maps a template input ID to its position on the creation screen.
func templateInputOrder(template *ent.Template) map[string]int {
	order := make(map[string]int)
	if template == nil {
		return order
	}
	for i, in := range template.Definition.Inputs {
		order[in.ID] = i
	}
	return order
}

func orderIndex(order map[string]int, inputID *string) int {
	if inputID == nil {
		return math.MaxInt
	}
	if idx, ok := order[*inputID]; ok {
		return idx
	}
	return math.MaxInt
}

func hostInfos(hosts []schema.HostSpec, order map[string]int) []*models.ServiceGroupHostInfo {
	infos := make([]*models.ServiceGroupHostInfo, 0, len(hosts))
	for _, host := range hosts {
		infos = append(infos, &models.ServiceGroupHostInfo{
			TemplateInputID: host.TemplateInputID,
			DisplayName:     host.DisplayName,
			Description:     host.Description,
			Host:            host.Host,
			Path:            host.Path,
			TargetPort:      host.TargetPort,
		})
	}
	sort.SliceStable(infos, func(i, j int) bool {
		return orderIndex(order, infos[i].TemplateInputID) < orderIndex(order, infos[j].TemplateInputID)
	})
	return infos
}

func (self *ServiceGroupService) variableInfos(ctx context.Context, client kubernetes.Interface, namespace string, service *ent.Service, metadata map[string]schema.VariableMetadata, order map[string]int) ([]*models.ServiceGroupVariableInfo, error) {
	infos := []*models.ServiceGroupVariableInfo{}
	if len(metadata) == 0 || service.KubernetesSecret == "" {
		return infos, nil
	}

	secrets, err := self.k8s.GetSecretMap(ctx, service.KubernetesSecret, namespace, client)
	if err != nil {
		return nil, err
	}

	for name, meta := range metadata {
		value, ok := secrets[name]
		if !ok {
			log.Warnf("Variable %s has metadata but is missing from secret for service %s", name, service.ID)
			continue
		}
		infos = append(infos, &models.ServiceGroupVariableInfo{
			TemplateInputID: meta.TemplateInputID,
			DisplayName:     meta.DisplayName,
			Description:     meta.Description,
			Name:            name,
			Value:           string(value),
		})
	}

	sort.SliceStable(infos, func(i, j int) bool {
		return orderIndex(order, infos[i].TemplateInputID) < orderIndex(order, infos[j].TemplateInputID)
	})
	return infos, nil
}
