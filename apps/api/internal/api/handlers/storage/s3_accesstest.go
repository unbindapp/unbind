package storage_handler

import (
	"context"

	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/infrastructure/s3"
)

// Test that S3 credentials are valid and can be used to list buckets and RW buckets
type TestS3AccessInput struct {
	server.BaseAuthInput
	Body struct {
		Endpoint    string `json:"endpoint" required:"true"`
		Region      string `json:"region" required:"true"`
		AccessKeyID string `json:"access_key_id" required:"true"`
		SecretKey   string `json:"secret_key" required:"true"`
	}
}

type S3TestResult struct {
	Valid bool   `json:"valid"`
	Error string `json:"error,omitempty"`
}

type TestS3Output struct {
	Body struct {
		Data *S3TestResult `json:"data"`
	}
}

func (self *HandlerGroup) TestS3Access(ctx context.Context, input *TestS3AccessInput) (*TestS3Output, error) {
	// Create client
	s3client, err := s3.NewS3Client(
		ctx,
		input.Body.Endpoint,
		input.Body.Region,
		input.Body.AccessKeyID,
		input.Body.SecretKey,
	)

	if err != nil {
		resp := &TestS3Output{}
		resp.Body.Data = &S3TestResult{
			Valid: false,
			Error: err.Error(),
		}
		return resp, nil
	}

	result := &S3TestResult{
		Valid: true,
	}
	err = s3client.ProbeAnyBucketRW(ctx)
	if err != nil {
		result.Valid = false
		result.Error = err.Error()
	}

	resp := &TestS3Output{}
	resp.Body.Data = result
	return resp, nil
}
