package unbindwebhooks_handler

import (
	"context"

	"github.com/danielgtaylor/huma/v2"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/models"
)

type UpdateWebhookInput struct {
	server.BaseAuthInput
	Body *models.WebhookUpdateInput
}

type UpdateWebhookResponse struct {
	Body struct {
		Data *models.WebhookResponse `json:"data"`
	}
}

func (self *HandlerGroup) UpdateWebhook(ctx context.Context, input *UpdateWebhookInput) (*UpdateWebhookResponse, error) {
	// Get caller
	user, found := self.srv.GetUserFromContext(ctx)
	if !found {
		log.Error("Error getting user from context")
		return nil, huma.Error401Unauthorized("Unable to retrieve user")
	}

	webhook, err := self.srv.WebhooksService.UpdateWebhook(ctx, user.ID, input.Body)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &UpdateWebhookResponse{}
	resp.Body.Data = webhook
	return resp, nil
}
