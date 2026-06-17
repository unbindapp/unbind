package team_service

import (
	"github.com/unbindapp/unbind-api/internal/infrastructure/k8s"
	"github.com/unbindapp/unbind-api/internal/repositories/repositories"
)

// Integrate team management with internal permissions and kubernetes RBAC
type TeamService struct {
	repo repositories.RepositoriesInterface
	k8s  k8s.KubeClientInterface
}

func NewTeamService(repo repositories.RepositoriesInterface, k8sClient k8s.KubeClientInterface) *TeamService {
	return &TeamService{
		repo: repo,
		k8s:  k8sClient,
	}
}
