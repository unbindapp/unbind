package variable_repo

import (
	"github.com/unbindapp/unbind-api/ent"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
)

// VariableRepository handles variable database operations
//
//go:generate go run -mod=mod github.com/vburenin/ifacemaker -f "*.go" -i VariableRepositoryInterface -p variable_repo -s VariableRepository -o variable_repository_iface.go
type VariableRepository struct {
	base *repository.BaseRepository
}

// NewVariableRepository creates a new repository
func NewVariableRepository(db *ent.Client) *VariableRepository {
	return &VariableRepository{
		base: &repository.BaseRepository{DB: db},
	}
}
