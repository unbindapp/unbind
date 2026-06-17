package instance_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	"github.com/unbindapp/unbind-api/internal/infrastructure/k8s"
	"github.com/unbindapp/unbind-api/internal/models"
)

// Get kubernetes container statuses for a service
func (self *InstanceService) GetInstanceStatuses(ctx context.Context, requesterUserID uuid.UUID, bearerToken string, input *models.InstanceStatusInput) ([]k8s.PodContainerStatus, error) {
	team, project, environment, service, err := self.validatePermissionsAndParseInputs(ctx, requesterUserID, input.Type, input.TeamID, input.ProjectID, input.EnvironmentID, input.ServiceID)
	if err != nil {
		return nil, err
	}

	// Determine labels
	labels := make(map[string]string)
	switch input.Type {
	case models.InstanceTypeService:
		labels["unbind-service"] = service.ID.String()
	case models.InstanceTypeEnvironment:
		labels["unbind-environment"] = environment.ID.String()
	case models.InstanceTypeProject:
		labels["unbind-project"] = project.ID.String()
	case models.InstanceTypeTeam:
		labels["unbind-team"] = team.ID.String()
	default:
		return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Invalid instance type")
	}

	// Create kubernetes client
	client, err := self.k8s.CreateClientWithToken(bearerToken)
	if err != nil {
		return nil, err
	}

	return self.k8s.GetPodContainerStatusByLabels(
		ctx,
		project.Edges.Team.Namespace,
		labels,
		client,
	)
}

// Get kubernetes container statuses for a service, simplified response
func (self *InstanceService) GetInstanceHealth(ctx context.Context, requesterUserID uuid.UUID, bearerToken string, input *models.InstanceHealthInput) (*k8s.SimpleHealthStatus, error) {
	team, _, _, service, err := self.validatePermissionsAndParseInputs(ctx, requesterUserID, models.InstanceTypeService, input.TeamID, input.ProjectID, input.EnvironmentID, input.ServiceID)
	if err != nil {
		return nil, err
	}

	// Determine labels
	labels := map[string]string{
		"unbind-service": service.ID.String(),
	}

	// Create kubernetes client
	client, err := self.k8s.CreateClientWithToken(bearerToken)
	if err != nil {
		return nil, err
	}

	// Override the expected replicas for not databases
	// This will override checking kubernetes state for replicas (DBs are complicated and may not match)
	var expectedReplicas *int
	if service.Type != schema.ServiceTypeDatabase {
		expectedReplicas = utils.ToPtr(int(service.Edges.ServiceConfig.Replicas))
	}
	return self.k8s.GetSimpleHealthStatus(ctx, team.Namespace, labels, expectedReplicas, client)
}
