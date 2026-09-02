package storage_handler

import (
	"context"

	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/infrastructure/s3"
)

type TestS3AccessInput struct {
	server.BaseAuthInput
	Body struct {
		Endpoint    string `json:"endpoint" required:"true" minLength:"1"`
		Region      string `json:"region" required:"true"`
		Bucket      string `json:"bucket" required:"true" minLength:"1"`
		AccessKeyID string `json:"access_key_id" required:"true" minLength:"1"`
		SecretKey   string `json:"secret_key" required:"true" minLength:"1"`
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
	resp := &TestS3Output{}
	resp.Body.Data = &S3TestResult{Valid: true}

	s3client, err := s3.NewS3Client(
		ctx,
		input.Body.Endpoint,
		input.Body.Region,
		input.Body.AccessKeyID,
		input.Body.SecretKey,
	)
	if err != nil {
		resp.Body.Data = &S3TestResult{Valid: false, Error: err.Error()}
		return resp, nil
	}

	if err := s3client.ProbeBucketRW(ctx, input.Body.Bucket); err != nil {
		resp.Body.Data = &S3TestResult{Valid: false, Error: err.Error()}
	}
	return resp, nil
}
