package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
)

type S3BucketResponse struct {
	ID        uuid.UUID `json:"id" format:"uuid"`
	Name      string    `json:"name"`
	Endpoint  string    `json:"endpoint"`
	Region    string    `json:"region"`
	Bucket    string    `json:"bucket"`
	AccessKey string    `json:"access_key"`
	SecretKey string    `json:"secret_key"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func TransformS3BucketEntity(entity *ent.S3Bucket, accessKey string, secretKey string) *S3BucketResponse {
	if entity == nil {
		return &S3BucketResponse{}
	}
	return &S3BucketResponse{
		ID:        entity.ID,
		Name:      entity.Name,
		Endpoint:  entity.Endpoint,
		Region:    entity.Region,
		Bucket:    entity.Bucket,
		AccessKey: accessKey,
		SecretKey: secretKey,
		CreatedAt: entity.CreatedAt,
		UpdatedAt: entity.UpdatedAt,
	}
}

func TransformS3BucketEntities(entities []*ent.S3Bucket, accessKeyMap map[uuid.UUID]string, secretKeyMap map[uuid.UUID]string) []*S3BucketResponse {
	responses := make([]*S3BucketResponse, len(entities))
	for i, entity := range entities {
		responses[i] = TransformS3BucketEntity(entity, accessKeyMap[entity.ID], secretKeyMap[entity.ID])
	}
	return responses
}
