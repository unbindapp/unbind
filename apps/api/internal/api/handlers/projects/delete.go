package projects_handler

import (
	"context"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/common/log"
	project_service "github.com/unbindapp/unbind-api/internal/services/project"
)

type DeleteProjectInput struct {
	server.BaseAuthInput
	Body struct {
		TeamID    uuid.UUID `json:"team_id" required:"true"`
		ProjectID uuid.UUID `json:"project_id" required:"true"`
	}
}

type DeleteProjectResponse struct {
	Body struct {
		Data server.DeletedResponse `json:"data"`
	}
}

func (self *HandlerGroup) DeleteProject(ctx context.Context, input *DeleteProjectInput) (*DeleteProjectResponse, error) {
	// Get caller
	user, found := self.srv.GetUserFromContext(ctx)
	if !found {
		log.Error("Error getting user from context")
		return nil, huma.Error401Unauthorized("Unable to retrieve user")
	}
	bearerToken, _ := self.srv.GetBearerTokenFromContext(ctx)

	err := self.srv.ProjectService.DeleteProject(ctx, user.ID, &project_service.DeleteProjectInput{
		TeamID:    input.Body.TeamID,
		ProjectID: input.Body.ProjectID,
	}, bearerToken)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &DeleteProjectResponse{}
	resp.Body.Data = server.DeletedResponse{
		ID:      input.Body.ProjectID.String(),
		Deleted: true,
	}
	return resp, nil
}
