package system_service

import (
	"github.com/unbindapp/unbind-api/config"
	"github.com/unbindapp/unbind-api/internal/infrastructure/buildkitd"
	"github.com/unbindapp/unbind-api/internal/infrastructure/k8s"
	"github.com/unbindapp/unbind-api/internal/infrastructure/registry"
	"github.com/unbindapp/unbind-api/internal/repositories/repositories"
)

// Integrate system management with internal permissions and kubernetes RBAC
type SystemService struct {
	cfg             *config.Config
	repo            repositories.RepositoriesInterface
	buildkitManager *buildkitd.BuildkitSettingsManager
	registryTester  *registry.RegistryTester
	k8s             k8s.KubeClientInterface
}

func NewSystemService(cfg *config.Config, repo repositories.RepositoriesInterface, buildkitManager *buildkitd.BuildkitSettingsManager, registryTester *registry.RegistryTester, k8s k8s.KubeClientInterface) *SystemService {
	return &SystemService{
		cfg:             cfg,
		repo:            repo,
		buildkitManager: buildkitManager,
		registryTester:  registryTester,
		k8s:             k8s,
	}
}
