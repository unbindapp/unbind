package s3bucket_repo

import (
	"github.com/unbindapp/unbind-api/ent"
	v1 "github.com/unbindapp/unbind-operator/api/v1"
)

func AsV1BackupConfig(bucket *ent.S3Bucket, config *ent.ServiceConfig) *v1.S3ConfigSpec {
	return &v1.S3ConfigSpec{
		Bucket:               bucket.Bucket,
		Endpoint:             bucket.Endpoint,
		Region:               bucket.Region,
		SecretName:           bucket.KubernetesSecret,
		BackupSchedule:       config.BackupSchedule,
		BackupRetentionCount: config.BackupRetentionCount,
	}
}
