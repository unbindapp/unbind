package replica_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/infrastructure/k8s"
	"github.com/unbindapp/unbind-api/internal/models"
)

// Get kubernetes container statuses for a service
func (self *ReplicaService) GetReplicaStatuses(ctx context.Context, requesterUserID uuid.UUID, input *models.ReplicaStatusInput) ([]k8s.PodContainerStatus, error) {
	team, project, environment, service, err := self.validatePermissionsAndParseInputs(ctx, requesterUserID, input.Type, input.TeamID, input.ProjectID, input.EnvironmentID, input.ServiceID)
	if err != nil {
		return nil, err
	}

	labels := make(map[string]string)
	switch input.Type {
	case models.ReplicaTypeService:
		labels["unbind-service"] = service.ID.String()
	case models.ReplicaTypeEnvironment:
		labels["unbind-environment"] = environment.ID.String()
	case models.ReplicaTypeProject:
		labels["unbind-project"] = project.ID.String()
	case models.ReplicaTypeTeam:
		labels["unbind-team"] = team.ID.String()
	default:
		return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Invalid replica type")
	}

	client := self.k8s.GetInternalClient()

	return self.k8s.GetPodContainerStatusByLabels(
		ctx,
		project.Edges.Team.Namespace,
		labels,
		client,
	)
}

// Get kubernetes container statuses for a service, simplified response
func (self *ReplicaService) GetReplicaHealth(ctx context.Context, requesterUserID uuid.UUID, input *models.ReplicaHealthInput) (*k8s.SimpleHealthStatus, error) {
	team, _, _, service, err := self.validatePermissionsAndParseInputs(ctx, requesterUserID, models.ReplicaTypeService, input.TeamID, input.ProjectID, input.EnvironmentID, input.ServiceID)
	if err != nil {
		return nil, err
	}

	labels := map[string]string{
		"unbind-service": service.ID.String(),
	}

	client := self.k8s.GetInternalClient()

	// Override the expected replicas for not databases
	// This will override checking kubernetes state for replicas (DBs are complicated and may not match)
	var expectedReplicas *int
	if service.Type != schema.ServiceTypeDatabase {
		expectedReplicas = new(int(service.Edges.ServiceConfig.Replicas))
	}
	return self.k8s.GetSimpleHealthStatus(ctx, team.Namespace, labels, expectedReplicas, client)
}
