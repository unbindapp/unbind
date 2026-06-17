package s3_repo

import (
	"github.com/unbindapp/unbind-api/ent"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
)

// S3Repository handles s3 database operations
//
//go:generate go run -mod=mod github.com/vburenin/ifacemaker -f "*.go" -i S3RepositoryInterface -p s3_repo -s S3Repository -o s3_repository_iface.go
type S3Repository struct {
	base *repository.BaseRepository
}

// NewS3Repository creates a new repository
func NewS3Repository(db *ent.Client) *S3Repository {
	return &S3Repository{
		base: &repository.BaseRepository{DB: db},
	}
}
