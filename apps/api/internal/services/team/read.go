package team_service

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/models"
)

// ListTeams retrieves all teams the user has permission to view
func (self *TeamService) ListTeams(ctx context.Context, userID uuid.UUID) ([]*models.TeamResponse, error) {
	teamPreds, err := self.repo.Permissions().GetAccessibleTeamPredicates(ctx, userID, schema.ActionViewer)
	if err != nil {
		return nil, fmt.Errorf("error getting accessible team predicates: %w", err)
	}

	// Get teams from repository, applying the permission predicate
	dbTeams, err := self.repo.Team().GetAll(ctx, teamPreds)
	if err != nil {
		return nil, fmt.Errorf("error getting all teams: %w", err)
	}

	permSet, err := self.repo.Permissions().GetUserPermissionSet(ctx, userID)
	if err != nil {
		return nil, err
	}

	resp := models.TransformTeamEntities(dbTeams)
	for _, team := range resp {
		team.Permissions = permSet.TeamActions(team.ID)
	}

	return resp, nil
}

// GetTeamByID retrieves a team by ID
func (self *TeamService) GetTeamByID(ctx context.Context, userID, teamID uuid.UUID) (*models.TeamResponse, error) {
	if err := self.repo.Permissions().CheckVisible(ctx, userID, schema.ResourceTypeTeam, teamID); err != nil {
		return nil, errdefs.MaskAsNotFound(err, "Team not found")
	}

	dbTeam, err := self.repo.Team().GetByID(ctx, teamID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Team not found")
		}
		return nil, err
	}

	permSet, err := self.repo.Permissions().GetUserPermissionSet(ctx, userID)
	if err != nil {
		return nil, err
	}

	resp := models.TransformTeamEntity(dbTeam)
	resp.Permissions = permSet.TeamActions(teamID)

	return resp, nil
}
