package team_repo

import (
	"github.com/unbindapp/unbind-api/ent"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
)

// TeamRepository handles GitHub-related database operations
//
//go:generate go run -mod=mod github.com/vburenin/ifacemaker -f "*.go" -i TeamRepositoryInterface -p team_repo -s TeamRepository -o team_repository_iface.go
type TeamRepository struct {
	base *repository.BaseRepository
}

// NewTeamRepository creates a new GitHub repository
func NewTeamRepository(db *ent.Client) *TeamRepository {
	return &TeamRepository{
		base: &repository.BaseRepository{DB: db},
	}
}
