package teams_handler

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/models"
)

type TeamResponse struct {
	Body struct {
		Data []*models.TeamResponse `json:"data" nullable:"false"`
	}
}

// ListTeams handles GET /teams
func (self *HandlerGroup) ListTeams(ctx context.Context, input *server.BaseAuthInput) (*TeamResponse, error) {
	user, bearerToken, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	teams, err := self.srv.TeamService.ListTeams(ctx, user.ID, bearerToken)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &TeamResponse{}
	resp.Body.Data = teams
	return resp, nil
}

// Get by ID
type GetTeamInput struct {
	server.BaseAuthInput
	TeamID uuid.UUID `query:"team_id" description:"The ID of the team to retrieve" required:"true"`
}

type GetTeamResponse struct {
	Body struct {
		Data *models.TeamResponse `json:"data" nullable:"false"`
	}
}

// GetTeam handles GET /teams/get
func (self *HandlerGroup) GetTeam(ctx context.Context, input *GetTeamInput) (*GetTeamResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	team, err := self.srv.TeamService.GetTeamByID(ctx, user.ID, input.TeamID)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &GetTeamResponse{}
	resp.Body.Data = team
	return resp, nil
}
