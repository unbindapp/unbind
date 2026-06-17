package middleware

import (
	"github.com/danielgtaylor/huma/v2"
	"github.com/unbindapp/unbind-api/config"
	"github.com/unbindapp/unbind-api/internal/auth"
	"github.com/unbindapp/unbind-api/internal/repositories/repositories"
)

type Middleware struct {
	tokenManager   *auth.TokenManager
	repository     repositories.RepositoriesInterface
	api            huma.API
	cfg            *config.Config
	allowedOrigins []string
}

func NewMiddleware(cfg *config.Config, repository repositories.RepositoriesInterface, api huma.API, tokenManager *auth.TokenManager, allowedOrigins []string) *Middleware {
	return &Middleware{
		tokenManager:   tokenManager,
		repository:     repository,
		api:            api,
		cfg:            cfg,
		allowedOrigins: allowedOrigins,
	}
}
