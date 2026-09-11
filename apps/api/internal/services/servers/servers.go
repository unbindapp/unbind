package servers_service

import (
	"context"

	"github.com/unbindapp/unbind-api/internal/infrastructure/k8s"
	"github.com/unbindapp/unbind-api/internal/models"
)

// Server capacity is visible to every authenticated user, like system meta, so template drafts can warn before deploying
type ServersService struct {
	k8s k8s.KubeClientInterface
}

func NewServersService(k8s k8s.KubeClientInterface) *ServersService {
	return &ServersService{k8s: k8s}
}

func (self *ServersService) List(ctx context.Context) ([]*models.ServerResponse, error) {
	return self.k8s.ListServers(ctx)
}
