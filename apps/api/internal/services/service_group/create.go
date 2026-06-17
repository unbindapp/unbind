package servicegroup_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/models"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

func (self *ServiceGroupService) CreateServiceGroup(ctx context.Context, requesterUserID uuid.UUID, input *models.CreateServiceGroupInput) (*models.ServiceGroupResponse, error) {
	// Check permissions
	permissionChecks := []permissions_repo.PermissionCheck{
		// Has permission to manage teams
		{
			Action:       schema.ActionEditor,
			ResourceType: schema.ResourceTypeEnvironment,
			ResourceID:   input.EnvironmentID,
		},
	}

	if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
		return nil, err
	}

	// Verify inputs
	_, _, err := self.VerifyInputs(ctx, input.TeamID, input.ProjectID, input.EnvironmentID)
	if err != nil {
		return nil, err
	}

	grp, err := self.repo.ServiceGroup().Create(ctx, nil, input.Name, input.Icon, input.Description, input.EnvironmentID)
	if err != nil {
		return nil, err
	}

	return models.TransformServiceGroupEntity(grp), nil
}
