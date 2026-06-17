package system_repo

import (
	"github.com/unbindapp/unbind-api/ent"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
)

// SystemRepository handles GitHub-related database operations
//
//go:generate go run -mod=mod github.com/vburenin/ifacemaker -f "*.go" -i SystemRepositoryInterface -p system_repo -s SystemRepository -o system_repository_iface.go
type SystemRepository struct {
	base *repository.BaseRepository
}

// NewSystemRepository creates a new GitHub repository
func NewSystemRepository(db *ent.Client) *SystemRepository {
	return &SystemRepository{
		base: &repository.BaseRepository{DB: db},
	}
}
