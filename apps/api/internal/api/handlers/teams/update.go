package teams_handler

import (
	"context"
	"errors"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/models"
	team_service "github.com/unbindapp/unbind-api/internal/services/team"
)

type UpdateTeamInput struct {
	server.BaseAuthInput
	Body struct {
		TeamID      uuid.UUID `json:"team_id" required:"true"`
		Name        string    `json:"name"`
		Description *string   `json:"description"`
	}
}

type UpdateTeamResponse struct {
	Body struct {
		Data *models.TeamResponse `json:"data"`
	}
}

// UpdateTeam handles PUT /team/{team_id}
func (self *HandlerGroup) UpdateTeam(ctx context.Context, input *UpdateTeamInput) (*UpdateTeamResponse, error) {
	// Get caller
	user, found := self.srv.GetUserFromContext(ctx)
	if !found {
		log.Error("Error getting user from context")
		return nil, huma.Error401Unauthorized("Unable to retrieve user")
	}

	updatedTeam, err := self.srv.TeamService.UpdateTeam(ctx, user.ID, &team_service.TeamUpdateInput{
		ID:          input.Body.TeamID,
		Name:        input.Body.Name,
		Description: input.Body.Description,
	})
	if err != nil {
		if errors.Is(err, errdefs.ErrInvalidInput) {
			return nil, huma.Error400BadRequest("invalid input", err)
		}
		if ent.IsNotFound(err) || errors.Is(err, errdefs.ErrNotFound) {
			return nil, huma.Error404NotFound("Team not found", err)
		}
		if errors.Is(err, errdefs.ErrUnauthorized) {
			return nil, huma.Error403Forbidden("Unauthorized")
		}
		log.Error("Error getting teams", "err", err)
		return nil, huma.Error500InternalServerError("Unable to update team")
	}

	resp := &UpdateTeamResponse{}
	resp.Body.Data = updatedTeam
	return resp, nil
}
