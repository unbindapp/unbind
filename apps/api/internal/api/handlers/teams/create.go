package teams_handler

import (
	"context"

	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/models"
	team_service "github.com/unbindapp/unbind-api/internal/services/team"
)

type CreateTeamInput struct {
	server.BaseAuthInput
	Body *team_service.CreateTeamInput
}

type CreateTeamResponse struct {
	Body struct {
		Data *models.TeamResponse `json:"data"`
	}
}

func (self *HandlerGroup) CreateTeam(ctx context.Context, input *CreateTeamInput) (*CreateTeamResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	team, err := self.srv.TeamService.CreateTeam(ctx, user.ID, input.Body)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &CreateTeamResponse{}
	resp.Body.Data = team
	return resp, nil
}
