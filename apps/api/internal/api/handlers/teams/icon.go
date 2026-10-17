package teams_handler

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/models"
)

// Room for a 50 KB file once base64 encoded, plus the JSON around it
const updateTeamIconMaxBodyBytes = 80 * 1024

// Served icons can't run anything, even when opened directly
const teamIconCSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox"

type UpdateTeamIconInput struct {
	server.BaseAuthInput
	Body struct {
		TeamID uuid.UUID `json:"team_id" format:"uuid" required:"true"`
		Data   []byte    `json:"data" required:"true" doc:"The icon file, base64 encoded. SVG, PNG or JPEG, up to 50 KB and 1024x1024."`
	}
}

type DeleteTeamIconInput struct {
	server.BaseAuthInput
	Body struct {
		TeamID uuid.UUID `json:"team_id" format:"uuid" required:"true"`
	}
}

type TeamIconResponse struct {
	Body struct {
		Data *models.TeamResponse `json:"data" nullable:"false"`
	}
}

type GetTeamIconInput struct {
	server.BaseAuthInput
	TeamID  uuid.UUID `query:"team_id" required:"true"`
	Version string    `query:"v" doc:"Cache key, the team's icon_updated_at"`
}

type GetTeamIconResponse struct {
	ContentType     string `header:"Content-Type"`
	CacheControl    string `header:"Cache-Control"`
	ContentSecurity string `header:"Content-Security-Policy"`
	NoSniff         string `header:"X-Content-Type-Options"`
	Body            []byte
}

func (self *HandlerGroup) UpdateTeamIcon(ctx context.Context, input *UpdateTeamIconInput) (*TeamIconResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	team, err := self.srv.TeamService.SetIcon(ctx, user.ID, input.Body.TeamID, input.Body.Data)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &TeamIconResponse{}
	resp.Body.Data = team
	return resp, nil
}

func (self *HandlerGroup) DeleteTeamIcon(ctx context.Context, input *DeleteTeamIconInput) (*TeamIconResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	team, err := self.srv.TeamService.DeleteIcon(ctx, user.ID, input.Body.TeamID)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &TeamIconResponse{}
	resp.Body.Data = team
	return resp, nil
}

func (self *HandlerGroup) GetTeamIcon(ctx context.Context, input *GetTeamIconInput) (*GetTeamIconResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	icon, err := self.srv.TeamService.GetIcon(ctx, user.ID, input.TeamID)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	cacheControl := "private, no-cache"
	if input.Version != "" {
		cacheControl = "private, max-age=31536000, immutable"
	}

	return &GetTeamIconResponse{
		ContentType:     icon.ContentType,
		CacheControl:    cacheControl,
		ContentSecurity: teamIconCSP,
		NoSniff:         "nosniff",
		Body:            icon.Data,
	}, nil
}
