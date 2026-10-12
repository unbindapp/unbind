package teams_handler

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
)

type DeleteTeamInput struct {
	server.BaseAuthInput
	Body struct {
		TeamID uuid.UUID `json:"team_id" format:"uuid" required:"true"`
	}
}

type DeleteTeamResponse struct {
	Body struct {
		Data server.DeletedResponse `json:"data"`
	}
}

func (self *HandlerGroup) DeleteTeam(ctx context.Context, input *DeleteTeamInput) (*DeleteTeamResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	if err := self.srv.TeamService.DeleteTeam(ctx, user.ID, input.Body.TeamID); err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &DeleteTeamResponse{}
	resp.Body.Data = server.DeletedResponse{
		ID:      input.Body.TeamID.String(),
		Deleted: true,
	}
	return resp, nil
}
