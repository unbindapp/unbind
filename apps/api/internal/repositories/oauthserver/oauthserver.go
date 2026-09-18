package oauthserver_repo

import (
	"github.com/unbindapp/unbind-api/ent"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
)

// OAuthServerRepository stores the authorization server's clients, codes,
// grants and tokens.
//
//go:generate go run -mod=mod github.com/vburenin/ifacemaker -f "*.go" -i OAuthServerRepositoryInterface -p oauthserver_repo -s OAuthServerRepository -o oauthserver_repository_iface.go
type OAuthServerRepository struct {
	base *repository.BaseRepository
}

func NewOAuthServerRepository(db *ent.Client) *OAuthServerRepository {
	return &OAuthServerRepository{base: &repository.BaseRepository{DB: db}}
}
