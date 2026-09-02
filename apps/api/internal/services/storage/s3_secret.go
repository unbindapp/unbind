package storage_service

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/infrastructure/s3"
)

type s3Connection struct {
	Endpoint    string
	Region      string
	Bucket      string
	AccessKeyID string
	SecretKey   string
}

func probeS3Bucket(ctx context.Context, conn s3Connection) error {
	s3Client, err := s3.NewS3Client(ctx, conn.Endpoint, conn.Region, conn.AccessKeyID, conn.SecretKey)
	if err != nil {
		return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, err.Error())
	}

	err = s3Client.ProbeBucketRW(ctx, conn.Bucket)
	if err == nil {
		return nil
	}
	var customErr *errdefs.CustomError
	if errors.As(err, &customErr) {
		return err
	}
	return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, err.Error())
}

// Plain keys plus INI-formatted aws files, some operators (like mysql) want the latter
func s3SecretValues(conn s3Connection) map[string][]byte {
	profile := "default"
	region := strings.TrimSpace(conn.Region)

	credentialsFile := fmt.Sprintf(`[%s]
aws_access_key_id = %s
aws_secret_access_key = %s
`, profile, conn.AccessKeyID, conn.SecretKey)

	configFile := fmt.Sprintf(`[%s]
region = %s
output = json
`, profile, region)

	return map[string][]byte{
		"access_key_id": []byte(conn.AccessKeyID),
		"secret_key":    []byte(conn.SecretKey),
		"credentials":   []byte(credentialsFile),
		"config":        []byte(configFile),
	}
}
