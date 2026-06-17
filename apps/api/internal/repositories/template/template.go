package template_repo

import (
	"github.com/unbindapp/unbind-api/ent"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
)

// TemplateRepository handles template database operations
//
//go:generate go run -mod=mod github.com/vburenin/ifacemaker -f "*.go" -i TemplateRepositoryInterface -p template_repo -s TemplateRepository -o template_repository_iface.go
type TemplateRepository struct {
	base *repository.BaseRepository
}

// NewTemplateRepository creates a new repository
func NewTemplateRepository(db *ent.Client) *TemplateRepository {
	return &TemplateRepository{
		base: &repository.BaseRepository{DB: db},
	}
}
