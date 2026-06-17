package oauth_repo

import (
	"github.com/unbindapp/unbind-api/ent"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
)

// OauthRepository handles oauth2 database operations
//
//go:generate go run -mod=mod github.com/vburenin/ifacemaker -f "*.go" -i OauthRepositoryInterface -p oauth_repo -s OauthRepository -o oauth_repository_iface.go
type OauthRepository struct {
	base *repository.BaseRepository
}

// NewOauthRepository creates a new repository
func NewOauthRepository(db *ent.Client) *OauthRepository {
	return &OauthRepository{
		base: &repository.BaseRepository{DB: db},
	}
}
