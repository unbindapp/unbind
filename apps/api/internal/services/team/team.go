package team_service

import (
	"github.com/unbindapp/unbind-api/config"
	"github.com/unbindapp/unbind-api/internal/infrastructure/k8s"
	"github.com/unbindapp/unbind-api/internal/repositories/repositories"
	project_service "github.com/unbindapp/unbind-api/internal/services/project"
	storage_service "github.com/unbindapp/unbind-api/internal/services/storage"
)

// Integrate team management with internal permissions and kubernetes RBAC
type TeamService struct {
	cfg                  *config.Config
	repo                 repositories.RepositoriesInterface
	k8s                  k8s.KubeClientInterface
	rbacManager          *k8s.RBACManager
	networkPolicyManager *k8s.NetworkPolicyManager
	projectService       *project_service.ProjectService
	storageService       *storage_service.StorageService
	mailer               Mailer
}

func NewTeamService(cfg *config.Config, repo repositories.RepositoriesInterface, k8sClient k8s.KubeClientInterface, rbacManager *k8s.RBACManager, networkPolicyManager *k8s.NetworkPolicyManager, projectService *project_service.ProjectService, storageService *storage_service.StorageService, mailer Mailer) *TeamService {
	return &TeamService{
		cfg:                  cfg,
		repo:                 repo,
		k8s:                  k8sClient,
		rbacManager:          rbacManager,
		networkPolicyManager: networkPolicyManager,
		projectService:       projectService,
		storageService:       storageService,
		mailer:               mailer,
	}
}
