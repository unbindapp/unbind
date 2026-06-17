package environments_handler

import (
	"context"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/models"
)

type GetEnvironmentInput struct {
	server.BaseAuthInput
	ID        uuid.UUID `query:"id" required:"true"`
	TeamID    uuid.UUID `query:"team_id" required:"true"`
	ProjectID uuid.UUID `query:"project_id" required:"true"`
}

type GetEnvironmentOutput struct {
	Body struct {
		Data *models.EnvironmentResponse `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) GetEnvironment(ctx context.Context, input *GetEnvironmentInput) (*GetEnvironmentOutput, error) {
	// Get caller
	user, found := self.srv.GetUserFromContext(ctx)
	if !found {
		log.Error("Error getting user from context")
		return nil, huma.Error401Unauthorized("Unable to retrieve user")
	}

	// Get environment
	environment, err := self.srv.EnvironmentService.GetEnvironmentByID(ctx, user.ID, input.TeamID, input.ProjectID, input.ID)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &GetEnvironmentOutput{}
	resp.Body.Data = environment
	return resp, nil
}

// Get all in a project
type ListEnvironmentInput struct {
	server.BaseAuthInput
	TeamID    uuid.UUID `query:"team_id" required:"true"`
	ProjectID uuid.UUID `query:"project_id" required:"true"`
}

type ListEnvironmentsOutput struct {
	Body struct {
		Data []*models.EnvironmentResponse `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) ListEnvironments(ctx context.Context, input *ListEnvironmentInput) (*ListEnvironmentsOutput, error) {
	// Get caller
	user, found := self.srv.GetUserFromContext(ctx)
	if !found {
		log.Error("Error getting user from context")
		return nil, huma.Error401Unauthorized("Unable to retrieve user")
	}

	// Get environments
	environments, err := self.srv.EnvironmentService.GetEnvironmentsByProjectID(ctx, user.ID, input.TeamID, input.ProjectID)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &ListEnvironmentsOutput{}
	resp.Body.Data = environments
	return resp, nil
}
