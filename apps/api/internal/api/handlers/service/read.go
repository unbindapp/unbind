package service_handler

import (
	"context"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/models"
)

type ListServiceInput struct {
	server.BaseAuthInput
	TeamID        uuid.UUID `query:"team_id" required:"true"`
	ProjectID     uuid.UUID `query:"project_id" required:"true"`
	EnvironmentID uuid.UUID `query:"environment_id" required:"true"`
}

type ListServiceResponse struct {
	Body struct {
		Data []*models.ServiceResponse `json:"data" nullable:"false"`
	}
}

// ListServices handles GET /services/list
func (self *HandlerGroup) ListServices(ctx context.Context, input *ListServiceInput) (*ListServiceResponse, error) {
	// Get caller
	user, found := self.srv.GetUserFromContext(ctx)
	if !found {
		log.Error("Error getting user from context")
		return nil, huma.Error401Unauthorized("Unable to retrieve user")
	}

	services, err := self.srv.ServiceService.GetServicesInEnvironment(
		ctx,
		user.ID,
		input.TeamID,
		input.ProjectID,
		input.EnvironmentID,
	)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &ListServiceResponse{}
	resp.Body.Data = services

	return resp, nil
}

// Get a single service by ID
type GetServiceInput struct {
	server.BaseAuthInput
	ServiceID     uuid.UUID `query:"service_id" required:"true"`
	TeamID        uuid.UUID `query:"team_id" required:"true"`
	ProjectID     uuid.UUID `query:"project_id" required:"true"`
	EnvironmentID uuid.UUID `query:"environment_id" required:"true"`
}

type GetServiceResponse struct {
	Body struct {
		Data *models.ServiceResponse `json:"data"`
	}
}

// GetService handles GET /services/get
func (self *HandlerGroup) GetService(ctx context.Context, input *GetServiceInput) (*GetServiceResponse, error) {
	// Get caller
	user, found := self.srv.GetUserFromContext(ctx)
	if !found {
		log.Error("Error getting user from context")
		return nil, huma.Error401Unauthorized("Unable to retrieve user")
	}

	service, err := self.srv.ServiceService.GetServiceByID(
		ctx,
		user.ID,
		input.TeamID,
		input.ProjectID,
		input.EnvironmentID,
		input.ServiceID,
	)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &GetServiceResponse{}
	resp.Body.Data = service
	return resp, nil
}
