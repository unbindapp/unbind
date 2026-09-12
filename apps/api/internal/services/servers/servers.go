package servers_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/infrastructure/k8s"
	"github.com/unbindapp/unbind-api/internal/models"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
	"github.com/unbindapp/unbind-api/internal/repositories/repositories"
)

// Server capacity is visible to every authenticated user, like system meta, so template drafts can warn before deploying
type ServersService struct {
	k8s  k8s.KubeClientInterface
	repo repositories.RepositoriesInterface
}

func NewServersService(k8s k8s.KubeClientInterface, repo repositories.RepositoriesInterface) *ServersService {
	return &ServersService{k8s: k8s, repo: repo}
}

func (self *ServersService) List(ctx context.Context) ([]*models.ServerResponse, error) {
	return self.k8s.ListServers(ctx)
}

// Get exposes hardware and condition details, so unlike List it is limited to system viewers
func (self *ServersService) Get(ctx context.Context, requesterUserID uuid.UUID, name string) (*models.ServerDetailResponse, error) {
	permissionChecks := []permissions_repo.PermissionCheck{
		{
			Action:       schema.ActionViewer,
			ResourceType: schema.ResourceTypeSystem,
		},
	}

	if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
		return nil, err
	}

	return self.k8s.GetServer(ctx, name)
}
