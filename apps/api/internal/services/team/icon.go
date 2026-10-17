package team_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/models"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

// SetIcon replaces the team's icon with an SVG, PNG or JPEG file.
func (self *TeamService) SetIcon(ctx context.Context, userID, teamID uuid.UUID, data []byte) (*models.TeamResponse, error) {
	if err := self.checkCanEditTeam(ctx, userID, teamID); err != nil {
		return nil, err
	}

	icon, err := parseIcon(data)
	if err != nil {
		return nil, err
	}

	if err := self.repo.Team().SetIcon(ctx, teamID, icon.contentType, icon.data); err != nil {
		return nil, err
	}
	return self.GetTeamByID(ctx, userID, teamID)
}

// DeleteIcon puts the team back on its default letter icon.
func (self *TeamService) DeleteIcon(ctx context.Context, userID, teamID uuid.UUID) (*models.TeamResponse, error) {
	if err := self.checkCanEditTeam(ctx, userID, teamID); err != nil {
		return nil, err
	}

	if err := self.repo.Team().DeleteIcon(ctx, teamID); err != nil {
		return nil, err
	}
	return self.GetTeamByID(ctx, userID, teamID)
}

// GetIcon returns the team's icon file to anyone who can see the team.
func (self *TeamService) GetIcon(ctx context.Context, userID, teamID uuid.UUID) (*ent.TeamIcon, error) {
	if err := self.repo.Permissions().CheckVisible(ctx, userID, schema.ResourceTypeTeam, teamID); err != nil {
		return nil, errdefs.MaskAsNotFound(err, "Team not found")
	}

	icon, err := self.repo.Team().GetIcon(ctx, teamID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Team has no icon")
		}
		return nil, err
	}
	return icon, nil
}

func (self *TeamService) checkCanEditTeam(ctx context.Context, userID, teamID uuid.UUID) error {
	return self.repo.Permissions().Check(ctx, userID, []permissions_repo.PermissionCheck{
		{
			Action:       schema.ActionEditor,
			ResourceType: schema.ResourceTypeTeam,
			ResourceID:   teamID,
		},
	})
}
