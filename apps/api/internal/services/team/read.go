package team_service

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/models"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

// ListTeams retrieves all teams the user has permission to view
func (self *TeamService) ListTeams(ctx context.Context, userID uuid.UUID, bearerToken string) ([]*models.TeamResponse, error) {
	teamPreds, err := self.repo.Permissions().GetAccessibleTeamPredicates(ctx, userID, schema.ActionViewer)
	if err != nil {
		return nil, fmt.Errorf("error getting accessible team predicates: %w", err)
	}

	// Get teams from repository, applying the permission predicate
	dbTeams, err := self.repo.Team().GetAll(ctx, teamPreds)
	if err != nil {
		return nil, fmt.Errorf("error getting all teams: %w", err)
	}

	return models.TransformTeamEntities(dbTeams), nil
}

// GetTeamByID retrieves a team by ID
func (self *TeamService) GetTeamByID(ctx context.Context, userID, teamID uuid.UUID) (*models.TeamResponse, error) {
	permissionChecks := []permissions_repo.PermissionCheck{
		// Has permission to read system resources
		{
			Action:       schema.ActionViewer,
			ResourceType: schema.ResourceTypeTeam,
			ResourceID:   teamID,
		},
	}
	if err := self.repo.Permissions().Check(
		ctx,
		userID,
		permissionChecks,
	); err != nil {
		return nil, err
	}

	dbTeam, err := self.repo.Team().GetByID(ctx, teamID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Team not found")
		}
		return nil, err
	}

	return models.TransformTeamEntity(dbTeam), nil
}
