package webhook_repo

import (
	"github.com/unbindapp/unbind-api/ent"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
)

// WebhookRepository handles webhook database operations
//
//go:generate go run -mod=mod github.com/vburenin/ifacemaker -f "*.go" -i WebhookRepositoryInterface -p webhook_repo -s WebhookRepository -o webhook_repository_iface.go
type WebhookRepository struct {
	base *repository.BaseRepository
}

// NewWebhookRepository creates a new repository
func NewWebhookRepository(db *ent.Client) *WebhookRepository {
	return &WebhookRepository{
		base: &repository.BaseRepository{DB: db},
	}
}
