package oauthserver_service

import (
	"context"
	"errors"
	"time"

	"github.com/unbindapp/unbind-api/internal/oauthserver"
	"github.com/unbindapp/unbind-api/internal/repositories/repositories"
)

const (
	CodeTTL          = time.Minute
	AccessTokenTTL   = time.Hour
	RefreshTokenTTL  = 30 * 24 * time.Hour
	lastUsedInterval = time.Minute
	retiredTokenKeep = 24 * time.Hour
	orphanClientKeep = 24 * time.Hour
)

var ErrInvalidAccessToken = errors.New("invalid access token")

type MetadataFetcher interface {
	Fetch(ctx context.Context, clientID string) (*oauthserver.ClientMetadata, error)
}

// OAuthServerService is the authorization server: it resolves clients, records
// consent, exchanges and refreshes tokens, and verifies them for /mcp.
//
//go:generate go run -mod=mod github.com/vburenin/ifacemaker -f "*.go" -i OAuthServerServiceInterface -p oauthserver_service -s OAuthServerService -o oauthserver_service_iface.go
type OAuthServerService struct {
	repo     repositories.RepositoriesInterface
	fetcher  MetadataFetcher
	issuer   string
	resource string
	now      func() time.Time
}

func NewOAuthServerService(repo repositories.RepositoriesInterface, fetcher MetadataFetcher, issuer string) *OAuthServerService {
	return &OAuthServerService{
		repo:     repo,
		fetcher:  fetcher,
		issuer:   issuer,
		resource: oauthserver.ResourceURL(issuer),
		now:      time.Now,
	}
}

func (self *OAuthServerService) Issuer() string {
	return self.issuer
}

func (self *OAuthServerService) Resource() string {
	return self.resource
}
