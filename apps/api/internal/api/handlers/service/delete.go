package service_handler

import (
	"context"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/common/log"
)

type DeleteServiceInput struct {
	server.BaseAuthInput
	Body struct {
		TeamID        uuid.UUID `json:"team_id" required:"true"`
		ProjectID     uuid.UUID `json:"project_id" required:"true"`
		EnvironmentID uuid.UUID `json:"environment_id" required:"true"`
		ServiceID     uuid.UUID `json:"service_id" required:"true"`
	}
}

type DeleteServiceResponse struct {
	Body struct {
		Data server.DeletedResponse `json:"data"`
	}
}

func (self *HandlerGroup) DeleteService(ctx context.Context, input *DeleteServiceInput) (*DeleteServiceResponse, error) {
	// Get caller
	user, found := self.srv.GetUserFromContext(ctx)
	if !found {
		log.Error("Error getting user from context")
		return nil, huma.Error401Unauthorized("Unable to retrieve user")
	}
	bearerToken, _ := self.srv.GetBearerTokenFromContext(ctx)

	err := self.srv.ServiceService.DeleteServiceByID(ctx, user.ID, bearerToken, input.Body.TeamID, input.Body.ProjectID, input.Body.EnvironmentID, input.Body.ServiceID)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &DeleteServiceResponse{}
	resp.Body.Data = server.DeletedResponse{
		ID:      input.Body.ServiceID.String(),
		Deleted: true,
	}
	return resp, nil
}
