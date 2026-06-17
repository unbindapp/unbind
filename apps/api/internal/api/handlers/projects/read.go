package projects_handler

import (
	"context"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/models"
)

type ListProjectInput struct {
	server.BaseAuthInput
	models.SortInput
	TeamID uuid.UUID `query:"team_id" required:"true"`
}

type ListProjectResponse struct {
	Body struct {
		Data []*models.ProjectResponse `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) ListProjects(ctx context.Context, input *ListProjectInput) (*ListProjectResponse, error) {
	// Get caller
	user, found := self.srv.GetUserFromContext(ctx)
	if !found {
		log.Error("Error getting user from context")
		return nil, huma.Error401Unauthorized("Unable to retrieve user")
	}

	projects, err := self.srv.ProjectService.GetProjectsInTeam(ctx, user.ID, input.TeamID, input.SortByField, input.SortOrder)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &ListProjectResponse{}
	resp.Body.Data = projects
	return resp, nil
}

// Get a single project by ID
type GetProjectInput struct {
	server.BaseAuthInput
	ProjectID uuid.UUID `query:"project_id" required:"true"`
	TeamID    uuid.UUID `query:"team_id" required:"true"`
}

type GetProjectResponse struct {
	Body struct {
		Data *models.ProjectResponse `json:"data"`
	}
}

func (self *HandlerGroup) GetProject(ctx context.Context, input *GetProjectInput) (*GetProjectResponse, error) {
	// Get caller
	user, found := self.srv.GetUserFromContext(ctx)
	if !found {
		log.Error("Error getting user from context")
		return nil, huma.Error401Unauthorized("Unable to retrieve user")
	}

	project, err := self.srv.ProjectService.GetProjectByID(ctx, user.ID, input.TeamID, input.ProjectID)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &GetProjectResponse{}
	resp.Body.Data = project
	return resp, nil
}
