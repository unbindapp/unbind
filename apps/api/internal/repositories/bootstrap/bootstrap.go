package bootstrap_repo

import (
	"github.com/unbindapp/unbind-api/ent"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
)

// BootstrapRepository handles bootstrap database operations
//
//go:generate go run -mod=mod github.com/vburenin/ifacemaker -f "*.go" -i BootstrapRepositoryInterface -p bootstrap_repo -s BootstrapRepository -o bootstrap_repository_iface.go
type BootstrapRepository struct {
	base *repository.BaseRepository
}

// NewBootstrapRepository creates a new repository
func NewBootstrapRepository(db *ent.Client) *BootstrapRepository {
	return &BootstrapRepository{
		base: &repository.BaseRepository{DB: db},
	}
}
