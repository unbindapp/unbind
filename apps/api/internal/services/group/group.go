package group_service

import (
	"github.com/unbindapp/unbind-api/internal/infrastructure/k8s"
	"github.com/unbindapp/unbind-api/internal/repositories/repositories"
)

// Integrate group management with internal permissions and kubernetes RBAC
type GroupService struct {
	repo        repositories.RepositoriesInterface
	rbacManager *k8s.RBACManager
}

func NewGroupService(repo repositories.RepositoriesInterface, rbacManager *k8s.RBACManager) *GroupService {
	return &GroupService{
		repo:        repo,
		rbacManager: rbacManager,
	}
}
