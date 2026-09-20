package environment_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/names"
	"github.com/unbindapp/unbind-api/internal/models"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

type UpdateEnvironmentInput struct {
	TeamID        uuid.UUID `json:"team_id" format:"uuid" required:"true"`
	ProjectID     uuid.UUID `json:"project_id" format:"uuid" required:"true"`
	EnvironmentID uuid.UUID `json:"environment_id" format:"uuid" required:"true"`
	Name          *string   `json:"name" minLength:"1" maxLength:"32" doc:"Has to be unique in the project"`
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

	if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
		return nil, err
	}

	_, environment, err := self.VerifyInputs(ctx, input.TeamID, input.ProjectID, input.EnvironmentID)
	if err != nil {
		return nil, err
	}

	if input.Name != nil {
		name, err := names.Clean(*input.Name)
		if err != nil {
			return nil, err
		}
		input.Name = &name
	}
	if input.Name != nil && *input.Name != environment.Name {
		takenNames, err := self.repo.Environment().GetNamesByProject(ctx, nil, input.ProjectID)
		if err != nil {
			return nil, err
		}
		if err := names.EnsureFree(*input.Name, takenNames, "environment", "project"); err != nil {
			return nil, err
		}
	}

	updated, err := self.repo.Environment().Update(ctx, environment.ID, input.Name, input.Description)
	if err != nil {
		return nil, err
	}

	permSet, err := self.repo.Permissions().GetUserPermissionSet(ctx, requesterUserID)
	if err != nil {
		return nil, err
	}

	resp := models.TransformEnvironmentEntity(updated)
	resp.Permissions = permSet.EnvironmentActions(input.TeamID, input.ProjectID, input.EnvironmentID)

	// Summarizes services
	counts, providerSummaries, err := self.repo.Service().SummarizeServices(ctx, []uuid.UUID{environment.ID}, nil)
	if err != nil {
		return nil, err
	}
	resp.ServiceCount, _ = counts[environment.ID]
	resp.ServiceIcons, _ = providerSummaries[environment.ID]

	return resp, nil
}
