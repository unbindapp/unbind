package projects_handler

import (
	"context"
	"errors"

	"github.com/danielgtaylor/huma/v2"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/models"
)

type UpdateProjectInput struct {
	server.BaseAuthInput
	Body models.UpdateProjectInput
}

type UpdateProjectResponse struct {
	Body struct {
		Data *models.ProjectResponse `json:"data"`
	}
}

func (self *HandlerGroup) UpdateProject(ctx context.Context, input *UpdateProjectInput) (*UpdateProjectResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	if input.Body.Name == "" && input.Body.Description == nil {
		return nil, huma.Error400BadRequest("Either display_name or description must be provided")
	}

	updatedProject, err := self.srv.ProjectService.UpdateProject(ctx, user.ID, &input.Body)
	if err != nil {
		if errors.Is(err, errdefs.ErrInvalidInput) {
			return nil, huma.Error400BadRequest(err.Error())
		}
		if errors.Is(err, errdefs.ErrUnauthorized) {
			return nil, huma.Error403Forbidden("Unauthorized")
		}
		if ent.IsNotFound(err) || errors.Is(err, errdefs.ErrNotFound) {
			return nil, huma.Error404NotFound(err.Error())
		}
		return nil, oapi.MapError(errdefs.NewInternalError(err, "Failed to update the project"))
	}

	resp := &UpdateProjectResponse{}
	resp.Body.Data = updatedProject
	return resp, nil
}
