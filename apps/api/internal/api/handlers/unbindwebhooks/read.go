package unbindwebhooks_handler

import (
	"context"

	"github.com/danielgtaylor/huma/v2"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/models"
)

type ListWebhooksInput struct {
	server.BaseAuthInput
	models.WebhookListInput
}

type ListWebhooksResponse struct {
	Body struct {
		Data []*models.WebhookResponse `json:"data" nullable:"false"`
	}
}

// ListWebhooks handles listing webhooks for a team or project
func (self *HandlerGroup) ListWebhooks(ctx context.Context, input *ListWebhooksInput) (*ListWebhooksResponse, error) {
	// Get caller
	user, found := self.srv.GetUserFromContext(ctx)
	if !found {
		log.Error("Error getting user from context")
		return nil, huma.Error401Unauthorized("Unable to retrieve user")
	}

	webhooks, err := self.srv.WebhooksService.ListWebhooks(
		ctx,
		user.ID,
		&input.WebhookListInput,
	)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &ListWebhooksResponse{}
	resp.Body.Data = webhooks
	return resp, nil
}

// Get a single webhook by ID
type GetWebhookInput struct {
	server.BaseAuthInput
	models.WebhookGetInput
}

type GetWebhookResponse struct {
	Body struct {
		Data *models.WebhookResponse `json:"data"`
	}
}

// GetWebhook handles getting a single webhook by ID
func (self *HandlerGroup) GetWebhook(ctx context.Context, input *GetWebhookInput) (*GetWebhookResponse, error) {
	// Get caller
	user, found := self.srv.GetUserFromContext(ctx)
	if !found {
		log.Error("Error getting user from context")
		return nil, huma.Error401Unauthorized("Unable to retrieve user")
	}

	webhook, err := self.srv.WebhooksService.GetWebhookByID(
		ctx,
		user.ID,
		&input.WebhookGetInput,
	)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &GetWebhookResponse{}
	resp.Body.Data = webhook
	return resp, nil
}
