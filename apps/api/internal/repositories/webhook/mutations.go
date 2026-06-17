package webhook_repo

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/internal/models"
)

func (self *WebhookRepository) Create(ctx context.Context, input *models.WebhookCreateInput) (*ent.Webhook, error) {
	return self.base.DB.Webhook.
		Create().
		SetTeamID(input.TeamID).
		SetType(input.Type).
		SetNillableProjectID(input.ProjectID).
		SetURL(input.URL).
		SetEvents(input.Events).
		Save(ctx)
}

func (self *WebhookRepository) Update(ctx context.Context, input *models.WebhookUpdateInput) (*ent.Webhook, error) {
	upd := self.base.DB.Webhook.
		UpdateOneID(input.ID)
	if input.URL != nil {
		upd.SetURL(*input.URL)
	}
	if input.Events != nil {
		upd.SetEvents(*input.Events)
	}
	return upd.Save(ctx)
}

func (self *WebhookRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return self.base.DB.Webhook.
		DeleteOneID(id).
		Exec(ctx)
}
