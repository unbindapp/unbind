package models

import (
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
)

// A copy of types.Bucket from AWS SDK v2, but with json tags and no null
type S3Bucket struct {
	BucketRegion string    `json:"bucket_region"`
	CreationDate time.Time `json:"created_at"`
	Name         string    `json:"name"`
}

func TransformBucketEntity(entity types.Bucket) *S3Bucket {
	return &S3Bucket{
		BucketRegion: aws.ToString(entity.BucketRegion),
		CreationDate: aws.ToTime(entity.CreationDate),
		Name:         aws.ToString(entity.Name),
	}
}

func TransformBucketEntities(entities []types.Bucket) []*S3Bucket {
	buckets := make([]*S3Bucket, len(entities))
	for i, entity := range entities {
		buckets[i] = TransformBucketEntity(entity)
	}
	return buckets
}

// *ent.S3 transformed into a S3Response
type S3Response struct {
	ID        uuid.UUID   `json:"id"`
	Name      string      `json:"name"`
	Endpoint  string      `json:"endpoint"`
	Region    string      `json:"region"`
	AccessKey string      `json:"access_key"`
	SecretKey string      `json:"secret_key"`
	Buckets   []*S3Bucket `json:"buckets" nullable:"false"`
	CreatedAt time.Time   `json:"created_at"`
	UpdatedAt time.Time   `json:"updated_at"`
}

// TransformS3Entity transforms an ent.S3 entity into a S3Response
func TransformS3Entity(entity *ent.S3, accessKey string, secretKey string, buckets []*S3Bucket) *S3Response {
	if buckets == nil {
		buckets = []*S3Bucket{}
	}

	response := &S3Response{}
	if entity != nil {
		response = &S3Response{
			ID:        entity.ID,
			Name:      entity.Name,
			Endpoint:  entity.Endpoint,
			Region:    entity.Region,
			AccessKey: accessKey,
			SecretKey: secretKey,
			Buckets:   buckets,
			CreatedAt: entity.CreatedAt,
			UpdatedAt: entity.UpdatedAt,
		}
	}
	return response
}

// Transforms a slice of ent.S3 entities into a slice of S3Response
func TransformS3Entities(entities []*ent.S3, accessKeyMap map[uuid.UUID]string, secretKeyMap map[uuid.UUID]string, bucketsMap map[uuid.UUID][]*S3Bucket) []*S3Response {
	responses := make([]*S3Response, len(entities))
	for i, entity := range entities {
		responses[i] = TransformS3Entity(entity, accessKeyMap[entity.ID], secretKeyMap[entity.ID], bucketsMap[entity.ID])
	}
	return responses
}
