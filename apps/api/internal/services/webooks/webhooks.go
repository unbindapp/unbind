package webhooks_service

import (
	"net/http"
	"time"

	"github.com/unbindapp/unbind-api/internal/repositories/repositories"
)

// A webhook target is whatever URL an editor typed, so the request is bounded
const (
	webhookTimeout       = 15 * time.Second
	maxWebhookErrorBytes = 4 << 10
)

// Integrate webhooks management with internal permissions and kubernetes RBAC
//
//go:generate go run -mod=mod github.com/vburenin/ifacemaker -f "*.go" -i WebhooksServiceInterface -p webhooks_service -s WebhooksService -o webhooks_service_iface.go
type WebhooksService struct {
	repo       repositories.RepositoriesInterface
	httpClient *http.Client
}

func NewWebhooksService(repo repositories.RepositoriesInterface) *WebhooksService {
	return &WebhooksService{
		repo:       repo,
		httpClient: &http.Client{Timeout: webhookTimeout},
	}
}
