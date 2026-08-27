package dbvolumes

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
)

func databaseService(dbType string, replicas int32, volumes []schema.ServiceVolume) *ent.Service {
	service := &ent.Service{
		ID:             uuid.MustParse("8d1f2a3b-4c5d-6e7f-8091-a2b3c4d5e6f7"),
		Type:           schema.ServiceTypeDatabase,
		Name:           "My DB",
		KubernetesName: "my-db-abc123",
		Database:       &dbType,
	}
	service.Edges.ServiceConfig = &ent.ServiceConfig{Replicas: replicas, Volumes: volumes}
	return service
}

func TestManaged(t *testing.T) {
	assert.False(t, Managed(nil), "an unmounted volume resize passes no service at all")
	assert.False(t, Managed(databaseService("postgres", 1, nil)), "an empty volume set means the operator still owns the storage")
	assert.True(t, Managed(databaseService("postgres", 1, []schema.ServiceVolume{{ID: "pgdata-my-db-abc123-0"}})))

	plain := &ent.Service{Type: schema.ServiceTypeDockerimage}
	plain.Edges.ServiceConfig = &ent.ServiceConfig{Volumes: []schema.ServiceVolume{{ID: "data"}}}
	assert.False(t, Managed(plain))
}

func TestPrimaryVolumeDerivesTheStatefulSetName(t *testing.T) {
	volumes, err := PrimaryVolume(databaseService("postgres", 3, nil), nil)
	require.NoError(t, err)
	require.Len(t, volumes, 1, "only the primary is recorded; replicas are provisioned at deploy")
	assert.Equal(t, "pgdata-my-db-abc123-0", volumes[0].ID)
	assert.Equal(t, "/home/postgres/pgdata", volumes[0].MountPath)
}

func TestPrimaryVolumeAdoptsAttachedNameWhereTheEngineAllowsIt(t *testing.T) {
	attached := []schema.ServiceVolume{{ID: "my-volume-xyz789"}}

	redis, err := PrimaryVolume(databaseService("redis", 1, nil), attached)
	require.NoError(t, err)
	require.Len(t, redis, 1)
	assert.Equal(t, "my-volume-xyz789", redis[0].ID, "redis mounts a claim by name")

	postgres, err := PrimaryVolume(databaseService("postgres", 1, nil), attached)
	require.NoError(t, err)
	require.Len(t, postgres, 1)
	assert.Equal(t, "pgdata-my-db-abc123-0", postgres[0].ID, "postgres derives its own name, so the volume is rebound onto it")
}

func TestPrimaryVolumeLeavesReplicatedSharedClaimEnginesAlone(t *testing.T) {
	volumes, err := PrimaryVolume(databaseService("redis", 2, nil), nil)
	require.NoError(t, err)
	assert.Nil(t, volumes, "every replica would be pointed at the same claim")
}

func TestPrimaryVolumeIgnoresUnsupportedEngines(t *testing.T) {
	volumes, err := PrimaryVolume(databaseService("cockroachdb", 1, nil), nil)
	require.NoError(t, err)
	assert.Nil(t, volumes)
}

func TestClaims(t *testing.T) {
	postgres := databaseService("postgres", 3, []schema.ServiceVolume{{ID: "pgdata-my-db-abc123-0"}})
	assert.Equal(t, []string{
		"pgdata-my-db-abc123-0",
		"pgdata-my-db-abc123-1",
		"pgdata-my-db-abc123-2",
	}, Claims(postgres), "every replica holds a full copy and has to grow with the primary")

	redis := databaseService("redis", 1, []schema.ServiceVolume{{ID: "my-volume-xyz789"}})
	assert.Equal(t, []string{"my-volume-xyz789"}, Claims(redis))

	assert.Nil(t, Claims(databaseService("postgres", 1, nil)))
	assert.Nil(t, Claims(nil))
}
