package replicas_handler

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
)

// Restart replicas
type RestartReplicasInput struct {
	server.BaseAuthInput
	Body struct {
		ServiceID     uuid.UUID `json:"service_id" required:"true"`
		TeamID        uuid.UUID `json:"team_id" required:"true"`
		ProjectID     uuid.UUID `json:"project_id" required:"true"`
		EnvironmentID uuid.UUID `json:"environment_id" required:"true"`
	}
}

type Restarted struct {
	Restarted bool `json:"restarted"`
}

type RestartServicesResponse struct {
	Body struct {
		Data *Restarted `json:"data"`
	}
}

// RestartReplicas handles PUT /replicas/restart
func (self *HandlerGroup) RestartReplicas(ctx context.Context, input *RestartReplicasInput) (*RestartServicesResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	err = self.srv.ServiceService.RestartServiceByID(
		ctx,
		user.ID,
		input.Body.TeamID,
		input.Body.ProjectID,
		input.Body.EnvironmentID,
		input.Body.ServiceID,
	)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &RestartServicesResponse{}
	resp.Body.Data = &Restarted{
		Restarted: true,
	}
	return resp, nil
}
