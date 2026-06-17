package servicegroup_repo

import (
	"github.com/unbindapp/unbind-api/ent"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
)

// ServiceGroupRepository handles service database operations
//
//go:generate go run -mod=mod github.com/vburenin/ifacemaker -f "*.go" -i ServiceGroupRepositoryInterface -p servicegroup_repo -s ServiceGroupRepository -o service_group_repository_iface.go
type ServiceGroupRepository struct {
	base *repository.BaseRepository
}

// NewServiceGroupRepository creates a new repository
func NewServiceGroupRepository(db *ent.Client) *ServiceGroupRepository {
	return &ServiceGroupRepository{
		base: &repository.BaseRepository{DB: db},
	}
}
