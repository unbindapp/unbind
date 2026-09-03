package variables_handler

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/models"
)

type ListReferenceableVariablesInput struct {
	server.BaseAuthInput
	TeamID        uuid.UUID `query:"team_id" required:"true"`
	ProjectID     uuid.UUID `query:"project_id" required:"true"`
	EnvironmentID uuid.UUID `query:"environment_id" required:"true"`
	ServiceID     uuid.UUID `query:"service_id" required:"true"`
}

type ReferenceableVariablesResponse struct {
	Body struct {
		Data []models.AvailableVariableReference `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) ListReferenceableVariables(ctx context.Context, input *ListReferenceableVariablesInput) (*ReferenceableVariablesResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	references, err := self.srv.VariablesService.GetAvailableVariableReferences(ctx, user.ID, input.TeamID, input.ProjectID, input.EnvironmentID, input.ServiceID)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &ReferenceableVariablesResponse{}
	resp.Body.Data = references
	return resp, nil
}
