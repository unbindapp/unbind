package s3bucket_repo

import (
	"github.com/unbindapp/unbind-api/ent"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
)

// S3BucketRepository handles s3 bucket database operations
//
//go:generate go run -mod=mod github.com/vburenin/ifacemaker -f "*.go" -i S3BucketRepositoryInterface -p s3bucket_repo -s S3BucketRepository -o s3bucket_repository_iface.go
type S3BucketRepository struct {
	base *repository.BaseRepository
}

func NewS3BucketRepository(db *ent.Client) *S3BucketRepository {
	return &S3BucketRepository{
		base: &repository.BaseRepository{DB: db},
	}
}
