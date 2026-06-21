package projects_handler

import (
	"context"

	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/models"
	project_service "github.com/unbindapp/unbind-api/internal/services/project"
)

type CreateProjectInput struct {
	server.BaseAuthInput
	Body *project_service.CreateProjectInput
}

type CreateProjectResponse struct {
	Body struct {
		Data *models.ProjectResponse `json:"data"`
	}
}

func (self *HandlerGroup) CreateProject(ctx context.Context, input *CreateProjectInput) (*CreateProjectResponse, error) {
	user, bearerToken, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	createdProject, err := self.srv.ProjectService.CreateProject(ctx, user.ID, input.Body, bearerToken)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &CreateProjectResponse{}
	resp.Body.Data = createdProject
	return resp, nil
}
