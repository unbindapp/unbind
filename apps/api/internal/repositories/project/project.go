package project_repo

import (
	"github.com/unbindapp/unbind-api/ent"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
)

// ProjectRepository handles GitHub-related database operations
//
//go:generate go run -mod=mod github.com/vburenin/ifacemaker -f "*.go" -i ProjectRepositoryInterface -p project_repo -s ProjectRepository -o project_repository_iface.go
type ProjectRepository struct {
	base *repository.BaseRepository
}

// NewProjectRepository creates a new GitHub repository
func NewProjectRepository(db *ent.Client) *ProjectRepository {
	return &ProjectRepository{
		base: &repository.BaseRepository{DB: db},
	}
}
