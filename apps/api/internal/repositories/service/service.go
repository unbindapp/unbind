package service_repo

import (
	"github.com/unbindapp/unbind-api/ent"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	deployment_repo "github.com/unbindapp/unbind-api/internal/repositories/deployment"
)

// ServiceRepository handles service database operations
//
//go:generate go run -mod=mod github.com/vburenin/ifacemaker -f "*.go" -i ServiceRepositoryInterface -p service_repo -s ServiceRepository -o service_repository_iface.go
type ServiceRepository struct {
	base           *repository.BaseRepository
	deploymentRepo deployment_repo.DeploymentRepositoryInterface
}

// NewServiceRepository creates a new repository
func NewServiceRepository(db *ent.Client, deploymentRepo deployment_repo.DeploymentRepositoryInterface) *ServiceRepository {
	return &ServiceRepository{
		base:           &repository.BaseRepository{DB: db},
		deploymentRepo: deploymentRepo,
	}
}
