package unbindwebhooks_handler

import (
	"context"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/common/log"
)

type DeleteWebhookInput struct {
	server.BaseAuthInput
	Body struct {
		ID     uuid.UUID          `json:"id" required:"true"`
		Type   schema.WebhookType `json:"type" required:"true"`
		TeamID uuid.UUID          `json:"team_id" required:"true"`
		// ProjectID is optional, but required if the webhook type is project
		ProjectID *uuid.UUID `json:"project_id" required:"false"`
	}
}

type DeleteWebhookResponse struct {
	Body struct {
		Data server.DeletedResponse `json:"data"`
	}
}

func (self *HandlerGroup) DeleteWebhook(ctx context.Context, input *DeleteWebhookInput) (*DeleteWebhookResponse, error) {
	// Get caller
	user, found := self.srv.GetUserFromContext(ctx)
	if !found {
		log.Error("Error getting user from context")
		return nil, huma.Error401Unauthorized("Unable to retrieve user")
	}

	err := self.srv.WebhooksService.DeleteWebhook(ctx, user.ID, input.Body.Type, input.Body.ID, input.Body.TeamID, input.Body.ProjectID)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &DeleteWebhookResponse{}
	resp.Body.Data = server.DeletedResponse{
		ID:      input.Body.ID.String(),
		Deleted: true,
	}
	return resp, nil
}
