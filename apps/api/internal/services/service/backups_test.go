package service_service

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/pkg/databases"
)

func TestHasBackupInput(t *testing.T) {
	bucketID := uuid.New()
	clearBucket := uuid.Nil

	assert.False(t, hasBackupInput(nil, nil, nil))
	assert.False(t, hasBackupInput(&clearBucket, nil, nil))
	assert.True(t, hasBackupInput(&bucketID, nil, nil))
	assert.True(t, hasBackupInput(nil, new("0 0 * * *"), nil))
	assert.True(t, hasBackupInput(&clearBucket, nil, new(3)))
}

func TestValidateBackupsSupported(t *testing.T) {
	provider := databases.NewDatabaseProvider()
	postgres, err := provider.FetchDatabaseDefinition(context.Background(), "", "postgres")
	require.NoError(t, err)
	redis, err := provider.FetchDatabaseDefinition(context.Background(), "", "redis")
	require.NoError(t, err)

	assert.NoError(t, validateBackupsSupported(schema.ServiceTypeDatabase, postgres))
	assert.ErrorContains(t, validateBackupsSupported(schema.ServiceTypeDatabase, redis), "Redis does not support backups")
	assert.ErrorContains(t, validateBackupsSupported(schema.ServiceTypeGithub, nil), "only apply to database services")
	assert.ErrorContains(t, validateBackupsSupported(schema.ServiceTypeDockerimage, postgres), "only apply to database services")
}
