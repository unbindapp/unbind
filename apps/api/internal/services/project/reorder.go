package project_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/models"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

type ReorderProjectsInput struct {
	TeamID     uuid.UUID   `json:"team_id" format:"uuid" required:"true"`
	ProjectIDs []uuid.UUID `json:"project_ids" format:"uuid" required:"true" minItems:"1" maxItems:"1000" nullable:"false" doc:"Projects in the order they should be listed. Projects left out keep their order after these."`
}

func (self *ProjectService) ReorderProjects(ctx context.Context, requesterUserID uuid.UUID, input *ReorderProjectsInput) ([]*models.ProjectResponse, error) {
	// The order is shared by the whole team, so changing it takes the same role as creating a project
	permissionChecks := []permissions_repo.PermissionCheck{
		{
			Action:       schema.ActionEditor,
			ResourceType: schema.ResourceTypeTeam,
			ResourceID:   input.TeamID,
		},
	}
	if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
		return nil, err
	}

	if err := self.repo.WithTx(ctx, func(tx repository.TxInterface) error {
		return self.repo.Project().Reorder(ctx, tx, input.TeamID, input.ProjectIDs)
	}); err != nil {
		return nil, err
	}

	return self.GetProjectsInTeam(ctx, requesterUserID, input.TeamID, models.SortByCustom, models.SortOrderAsc)
}
