package environment_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/models"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

type UpdateEnvironmentInput struct {
	TeamID        uuid.UUID `json:"team_id" format:"uuid" required:"true"`
	ProjectID     uuid.UUID `json:"project_id" format:"uuid" required:"true"`
	EnvironmentID uuid.UUID `json:"environment_id" format:"uuid" required:"true"`
	Name          *string   `json:"name"`
	Description   *string   `json:"description"`
}

func (self *EnvironmentService) UpdateEnvironment(ctx context.Context, requesterUserID uuid.UUID, input *UpdateEnvironmentInput) (*models.EnvironmentResponse, error) {
	permissionChecks := []permissions_repo.PermissionCheck{
		// Project editor can create environments
		{
			Action:       schema.ActionEditor,
			ResourceType: schema.ResourceTypeEnvironment,
			ResourceID:   input.EnvironmentID,
		},
	}

	// Check permissions
	if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
		return nil, err
	}

	// Verify inputs
	_, environment, err := self.VerifyInputs(ctx, input.TeamID, input.ProjectID, input.EnvironmentID)
	if err != nil {
		return nil, err
	}

	// Update the environment
	updated, err := self.repo.Environment().Update(ctx, environment.ID, input.Name, input.Description)
	if err != nil {
		return nil, err
	}

	// Convert to response
	resp := models.TransformEnvironmentEntity(updated)

	// Summarizes services
	counts, providerSummaries, err := self.repo.Service().SummarizeServices(ctx, []uuid.UUID{environment.ID})
	if err != nil {
		return nil, err
	}
	resp.ServiceCount, _ = counts[environment.ID]
	resp.ServiceIcons, _ = providerSummaries[environment.ID]

	return resp, nil
}
