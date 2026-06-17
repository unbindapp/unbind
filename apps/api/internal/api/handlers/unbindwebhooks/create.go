package unbindwebhooks_handler

import (
	"context"

	"github.com/danielgtaylor/huma/v2"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/models"
)

type CreateWebhookInput struct {
	server.BaseAuthInput
	Body *models.WebhookCreateInput
}

type CreateWebhookResponse struct {
	Body struct {
		Data *models.WebhookResponse `json:"data"`
	}
}

func (self *HandlerGroup) CreateWebhook(ctx context.Context, input *CreateWebhookInput) (*CreateWebhookResponse, error) {
	// Get caller
	user, found := self.srv.GetUserFromContext(ctx)
	if !found {
		log.Error("Error getting user from context")
		return nil, huma.Error401Unauthorized("Unable to retrieve user")
	}

	webhook, err := self.srv.WebhooksService.CreateWebhook(ctx, user.ID, input.Body)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &CreateWebhookResponse{}
	resp.Body.Data = webhook
	return resp, nil
}
