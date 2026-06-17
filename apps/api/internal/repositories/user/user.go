package user_repo

import (
	"github.com/unbindapp/unbind-api/ent"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
)

// UserRepository handles user database operations
//
//go:generate go run -mod=mod github.com/vburenin/ifacemaker -f "*.go" -i UserRepositoryInterface -p user_repo -s UserRepository -o user_repository_iface.go
type UserRepository struct {
	base *repository.BaseRepository
}

// NewUserRepository creates a new repository
func NewUserRepository(db *ent.Client) *UserRepository {
	return &UserRepository{
		base: &repository.BaseRepository{DB: db},
	}
}
