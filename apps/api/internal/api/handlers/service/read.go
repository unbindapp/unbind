package service_handler

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
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
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
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
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
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
