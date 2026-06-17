package project_service

import (
	"github.com/unbindapp/unbind-api/config"
	"github.com/unbindapp/unbind-api/internal/deployctl"
	"github.com/unbindapp/unbind-api/internal/infrastructure/k8s"
	"github.com/unbindapp/unbind-api/internal/repositories/repositories"
	webhooks_service "github.com/unbindapp/unbind-api/internal/services/webooks"
)

// Integrate project management with internal permissions and kubernetes RBAC
type ProjectService struct {
	cfg            *config.Config
	repo           repositories.RepositoriesInterface
	k8s            k8s.KubeClientInterface
	webhookService *webhooks_service.WebhooksService
	deployCtl      *deployctl.DeploymentController
}

func NewProjectService(cfg *config.Config, repo repositories.RepositoriesInterface, k8sClient k8s.KubeClientInterface, webhookService *webhooks_service.WebhooksService, deployCtl *deployctl.DeploymentController) *ProjectService {
	return &ProjectService{
		cfg:            cfg,
		repo:           repo,
		k8s:            k8sClient,
		webhookService: webhookService,
		deployCtl:      deployCtl,
	}
}
