package service_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/models"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

type ReorderServicesInput struct {
	TeamID        uuid.UUID   `json:"team_id" format:"uuid" required:"true"`
	ProjectID     uuid.UUID   `json:"project_id" format:"uuid" required:"true"`
	EnvironmentID uuid.UUID   `json:"environment_id" format:"uuid" required:"true"`
	IDs           []uuid.UUID `json:"ids" format:"uuid" required:"true" minItems:"1" maxItems:"1000" nullable:"false" doc:"Service groups and services that are not in a group, in the order they should be listed. The ones left out keep their order after these. Order the services inside a group with reorder-service-group."`
}

type ReorderServiceGroupInput struct {
	TeamID         uuid.UUID   `json:"team_id" format:"uuid" required:"true"`
	ProjectID      uuid.UUID   `json:"project_id" format:"uuid" required:"true"`
	EnvironmentID  uuid.UUID   `json:"environment_id" format:"uuid" required:"true"`
	ServiceGroupID uuid.UUID   `json:"service_group_id" format:"uuid" required:"true"`
	ServiceIDs     []uuid.UUID `json:"service_ids" format:"uuid" required:"true" minItems:"1" maxItems:"1000" nullable:"false" doc:"Services of the group in the order they should be listed. The ones left out keep their order after these."`
}

func (self *ServiceService) ReorderServices(ctx context.Context, requesterUserID uuid.UUID, input *ReorderServicesInput) ([]*models.ServiceResponse, error) {
	if err := self.checkCanReorder(ctx, requesterUserID, input.TeamID, input.ProjectID, input.EnvironmentID); err != nil {
		return nil, err
	}

	if err := self.repo.WithTx(ctx, func(tx repository.TxInterface) error {
		return self.repo.Service().ReorderEnvironment(ctx, tx, input.EnvironmentID, input.IDs)
	}); err != nil {
		return nil, err
	}

	return self.GetServicesInEnvironment(ctx, requesterUserID, input.TeamID, input.ProjectID, input.EnvironmentID, models.SortByCustom, models.SortOrderAsc)
}

func (self *ServiceService) ReorderServiceGroup(ctx context.Context, requesterUserID uuid.UUID, input *ReorderServiceGroupInput) ([]*models.ServiceResponse, error) {
	if err := self.checkCanReorder(ctx, requesterUserID, input.TeamID, input.ProjectID, input.EnvironmentID); err != nil {
		return nil, err
	}

	group, err := self.repo.ServiceGroup().GetByID(ctx, input.ServiceGroupID)
	if err != nil && !ent.IsNotFound(err) {
		return nil, err
	}
	if group == nil || group.EnvironmentID != input.EnvironmentID {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Service group not found")
	}

	if err := self.repo.WithTx(ctx, func(tx repository.TxInterface) error {
		return self.repo.Service().ReorderGroup(ctx, tx, input.ServiceGroupID, input.ServiceIDs)
	}); err != nil {
		return nil, err
	}

	return self.GetServicesInEnvironment(ctx, requesterUserID, input.TeamID, input.ProjectID, input.EnvironmentID, models.SortByCustom, models.SortOrderAsc)
}

// The order is shared by everyone who sees the environment, so changing it
// takes the same role as adding a service to it
func (self *ServiceService) checkCanReorder(ctx context.Context, requesterUserID, teamID, projectID, environmentID uuid.UUID) error {
	permissionChecks := []permissions_repo.PermissionCheck{
		{
			Action:       schema.ActionEditor,
			ResourceType: schema.ResourceTypeEnvironment,
			ResourceID:   environmentID,
		},
	}
	if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
		return err
	}

	_, _, err := self.VerifyInputs(ctx, teamID, projectID, environmentID)
	return err
}
