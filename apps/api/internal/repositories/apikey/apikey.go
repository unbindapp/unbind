package apikey_repo

import (
	"github.com/unbindapp/unbind-api/ent"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
)

// APIKeyRepository handles API key database operations
//
//go:generate go run -mod=mod github.com/vburenin/ifacemaker -f "*.go" -i APIKeyRepositoryInterface -p apikey_repo -s APIKeyRepository -o apikey_repository_iface.go
type APIKeyRepository struct {
	base *repository.BaseRepository
}

func NewAPIKeyRepository(db *ent.Client) *APIKeyRepository {
	return &APIKeyRepository{base: &repository.BaseRepository{DB: db}}
}
