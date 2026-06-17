package deployment_repo

import (
	"github.com/unbindapp/unbind-api/ent"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
)

// DeploymentRepository handles GitHub-related database operations
//
//go:generate go run -mod=mod github.com/vburenin/ifacemaker -f "*.go" -i DeploymentRepositoryInterface -p deployment_repo -s DeploymentRepository -o deployment_repository_iface.go
type DeploymentRepository struct {
	base *repository.BaseRepository
}

// NewDeploymentRepository creates a new repository
func NewDeploymentRepository(db *ent.Client) *DeploymentRepository {
	return &DeploymentRepository{
		base: &repository.BaseRepository{DB: db},
	}
}
