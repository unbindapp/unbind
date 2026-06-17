package group_repo

import (
	"github.com/unbindapp/unbind-api/ent"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

// GroupRepository handles GitHub-related database operations
//
//go:generate go run -mod=mod github.com/vburenin/ifacemaker -f "*.go" -i GroupRepositoryInterface -p group_repo -s GroupRepository -o group_repository_iface.go
type GroupRepository struct {
	base            *repository.BaseRepository
	permissionsRepo permissions_repo.PermissionsRepositoryInterface
}

// NewGroupRepository creates a new GitHub repository
func NewGroupRepository(db *ent.Client, permissionsRepo permissions_repo.PermissionsRepositoryInterface) *GroupRepository {
	return &GroupRepository{
		base:            &repository.BaseRepository{DB: db},
		permissionsRepo: permissionsRepo,
	}
}
