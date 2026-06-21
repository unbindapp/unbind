package github_repo

import (
	"github.com/unbindapp/unbind-api/ent"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
)

// GithubRepository handles GitHub-related database operations
//
//go:generate go run -mod=mod github.com/vburenin/ifacemaker -f "*.go" -i GithubRepositoryInterface -p github_repo -s GithubRepository -o github_repository_iface.go
type GithubRepository struct {
	base *repository.BaseRepository
}

func NewGithubRepository(db *ent.Client) *GithubRepository {
	return &GithubRepository{
		base: &repository.BaseRepository{DB: db},
	}
}
