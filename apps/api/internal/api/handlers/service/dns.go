package service_handler

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/models"
)

type ListEndpointsInput struct {
	server.BaseAuthInput
	TeamID        uuid.UUID `query:"team_id" required:"true"`
	ProjectID     uuid.UUID `query:"project_id" required:"true"`
	EnvironmentID uuid.UUID `query:"environment_id" required:"true"`
	ServiceID     uuid.UUID `query:"service_id" required:"true"`
}

type ListEndpointsResponse struct {
	Body struct {
		Data *models.EndpointDiscovery `json:"data"`
	}
}

// ListEndpoints handles GET /services/endpoints/list
func (self *HandlerGroup) ListEndpoints(ctx context.Context, input *ListEndpointsInput) (*ListEndpointsResponse, error) {
	user, bearerToken, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	endpoints, err := self.srv.ServiceService.GetDNSForService(
		ctx,
		user.ID,
		bearerToken,
		input.TeamID,
		input.ProjectID,
		input.EnvironmentID,
		input.ServiceID,
	)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &ListEndpointsResponse{}
	resp.Body.Data = endpoints
	return resp, nil
}
