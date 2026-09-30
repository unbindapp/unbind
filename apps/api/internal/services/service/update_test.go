package service_service

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/models"
)

func TestDatabasePortsWithNodePorts(t *testing.T) {
	ports := []schema.PortSpec{{Port: 9000}, {Port: 8123}}

	exposed := databasePortsWithNodePorts(ports, []int32{32000, 32001})
	assert.Equal(t, []schema.PortSpec{
		{Port: 9000, IsNodePort: true, NodePort: new(int32(32000))},
		{Port: 8123, IsNodePort: true, NodePort: new(int32(32001))},
	}, exposed)

	// A database made private keeps its ports, without an external one
	assert.Equal(t, []schema.PortSpec{{Port: 9000}, {Port: 8123}}, databasePortsWithNodePorts(exposed, nil))

	// Fewer allocated ports than the database speaks, only the first is exposed
	assert.Equal(t, []schema.PortSpec{
		{Port: 9000, IsNodePort: true, NodePort: new(int32(32000))},
		{Port: 8123},
	}, databasePortsWithNodePorts(ports, []int32{32000}))

	assert.Empty(t, databasePortsWithNodePorts(nil, []int32{32000}))
}

func TestRemovesLastHost(t *testing.T) {
	existing := []schema.HostSpec{{Host: "a.com"}, {Host: "b.com"}}
	removeAll := &models.UpdateServiceInput{RemoveHosts: existing}

	assert.True(t, removesLastHost(existing, removeAll))
	assert.False(t, removesLastHost(existing, &models.UpdateServiceInput{RemoveHosts: existing[:1]}))
	assert.False(t, removesLastHost(existing, &models.UpdateServiceInput{
		RemoveHosts: existing,
		UpsertHosts: []schema.HostSpec{{Host: "c.com"}},
	}))
	assert.False(t, removesLastHost(nil, removeAll))
	assert.False(t, removesLastHost(existing, &models.UpdateServiceInput{}))
}

func TestNewVolumes(t *testing.T) {
	existing := []schema.ServiceVolume{{ID: "pvc-1", MountPath: "/data"}}

	// A mount path change on an attached volume is not a new attach
	assert.Empty(t, newVolumes(existing, []schema.ServiceVolume{{ID: "pvc-1", MountPath: "/files"}}))

	assert.Equal(t, []schema.ServiceVolume{{ID: "pvc-2", MountPath: "/data"}}, newVolumes(
		existing,
		[]schema.ServiceVolume{{ID: "pvc-1", MountPath: "/files"}},
		[]schema.ServiceVolume{{ID: "pvc-2", MountPath: "/data"}},
	))
	assert.Equal(t, []schema.ServiceVolume{{ID: "pvc-2", MountPath: "/data"}}, newVolumes(
		nil,
		[]schema.ServiceVolume{{ID: "pvc-2", MountPath: "/data"}},
	))
	assert.Empty(t, newVolumes(existing))
}

func TestValidateDatabaseVolumeInputKeepsAttachedVolume(t *testing.T) {
	service := &ent.Service{Edges: ent.ServiceEdges{ServiceConfig: &ent.ServiceConfig{
		Volumes: []schema.ServiceVolume{{ID: "pvc-1", MountPath: "/data"}},
	}}}

	// Re-sending the attached volume is not a second attach
	assert.NoError(t, validateDatabaseVolumeInput(service, nil, []schema.ServiceVolume{{ID: "pvc-1", MountPath: "/data"}}, nil, nil))
	assert.Error(t, validateDatabaseVolumeInput(service, nil, []schema.ServiceVolume{{ID: "pvc-2", MountPath: "/data"}}, nil, nil))
}

func TestValidateVolumeCount(t *testing.T) {
	data := schema.ServiceVolume{ID: "pvc-1", MountPath: "/data"}
	files := schema.ServiceVolume{ID: "pvc-2", MountPath: "/files"}
	mounted := []schema.ServiceVolume{data}

	assert.NoError(t, validateVolumeCount(nil, &models.UpdateServiceInput{AddVolumes: []schema.ServiceVolume{data}}))
	assert.NoError(t, validateVolumeCount(nil, &models.UpdateServiceInput{OverwriteVolumes: []schema.ServiceVolume{data}}))
	assert.NoError(t, validateVolumeCount(mounted, &models.UpdateServiceInput{}))

	assert.ErrorContains(t, validateVolumeCount(mounted, &models.UpdateServiceInput{AddVolumes: []schema.ServiceVolume{files}}), "Unmount the current one first")
	assert.ErrorContains(t, validateVolumeCount(nil, &models.UpdateServiceInput{AddVolumes: []schema.ServiceVolume{data, files}}), SingleVolumeMessage)
	assert.ErrorContains(t, validateVolumeCount(nil, &models.UpdateServiceInput{OverwriteVolumes: []schema.ServiceVolume{data, files}}), SingleVolumeMessage)

	// A mount path change re-adds the mounted volume
	assert.NoError(t, validateVolumeCount(mounted, &models.UpdateServiceInput{
		AddVolumes: []schema.ServiceVolume{{ID: data.ID, MountPath: "/other"}},
	}))

	// Swapping volumes can go in one request
	assert.NoError(t, validateVolumeCount(mounted, &models.UpdateServiceInput{
		RemoveVolumes: []schema.ServiceVolume{data},
		AddVolumes:    []schema.ServiceVolume{files},
	}))
	assert.NoError(t, validateVolumeCount(mounted, &models.UpdateServiceInput{OverwriteVolumes: []schema.ServiceVolume{files}}))

	// Unmounting is always possible
	assert.NoError(t, validateVolumeCount([]schema.ServiceVolume{data, files}, &models.UpdateServiceInput{RemoveVolumes: []schema.ServiceVolume{files}}))
}

func TestValidateVolumeReplicas(t *testing.T) {
	volume := schema.ServiceVolume{ID: "pvc-1", MountPath: "/data"}
	other := schema.ServiceVolume{ID: "pvc-2", MountPath: "/data"}
	single := &ent.ServiceConfig{Replicas: 1}
	replicated := &ent.ServiceConfig{Replicas: 3}
	withVolume := &ent.ServiceConfig{Replicas: 1, Volumes: []schema.ServiceVolume{volume}}
	legacy := &ent.ServiceConfig{Replicas: 3, Volumes: []schema.ServiceVolume{volume}}

	assert.NoError(t, validateVolumeReplicas(single, &models.UpdateServiceInput{AddVolumes: []schema.ServiceVolume{volume}}))
	assert.NoError(t, validateVolumeReplicas(replicated, &models.UpdateServiceInput{Replicas: new(int32(5))}))

	assert.ErrorContains(t, validateVolumeReplicas(replicated, &models.UpdateServiceInput{AddVolumes: []schema.ServiceVolume{volume}}), "Set its replicas to 1")
	assert.ErrorContains(t, validateVolumeReplicas(replicated, &models.UpdateServiceInput{OverwriteVolumes: []schema.ServiceVolume{volume}}), "Set its replicas to 1")
	assert.ErrorContains(t, validateVolumeReplicas(single, &models.UpdateServiceInput{
		Replicas:   new(int32(2)),
		AddVolumes: []schema.ServiceVolume{volume},
	}), "Set its replicas to 1")

	// Lowering the replicas and mounting can go in one request
	assert.NoError(t, validateVolumeReplicas(replicated, &models.UpdateServiceInput{
		Replicas:   new(int32(1)),
		AddVolumes: []schema.ServiceVolume{volume},
	}))

	assert.ErrorContains(t, validateVolumeReplicas(withVolume, &models.UpdateServiceInput{Replicas: new(int32(2))}), singleReplicaWithVolumeMessage)
	assert.ErrorContains(t, validateVolumeReplicas(withVolume, &models.UpdateServiceInput{
		Replicas:         new(int32(2)),
		OverwriteVolumes: []schema.ServiceVolume{{ID: volume.ID, MountPath: "/files"}},
	}), singleReplicaWithVolumeMessage)

	// Unmounting and scaling up can go in one request
	assert.NoError(t, validateVolumeReplicas(withVolume, &models.UpdateServiceInput{
		Replicas:      new(int32(2)),
		RemoveVolumes: []schema.ServiceVolume{volume},
	}))

	// A service that broke the rule before it existed can still be edited and fixed
	assert.NoError(t, validateVolumeReplicas(legacy, &models.UpdateServiceInput{}))
	assert.NoError(t, validateVolumeReplicas(legacy, &models.UpdateServiceInput{Replicas: new(int32(1))}))
	assert.Error(t, validateVolumeReplicas(legacy, &models.UpdateServiceInput{AddVolumes: []schema.ServiceVolume{other}}))
}

func TestReleasedVolumes(t *testing.T) {
	existing := []schema.ServiceVolume{{ID: "pvc-1", MountPath: "/data"}, {ID: "pvc-2", MountPath: "/cache"}}

	assert.Equal(t, []string{"pvc-1"}, releasedVolumes(existing, nil, nil, []schema.ServiceVolume{{ID: "pvc-1"}}))
	assert.Equal(t, []string{"pvc-2"}, releasedVolumes(existing, []schema.ServiceVolume{{ID: "pvc-1", MountPath: "/files"}}, nil, nil))
	assert.Equal(t, []string{"pvc-1", "pvc-2"}, releasedVolumes(existing, []schema.ServiceVolume{{ID: "pvc-3", MountPath: "/data"}}, nil, nil))

	// A path change or a removal undone by an add in the same update keeps the claim
	assert.Empty(t, releasedVolumes(existing, nil, []schema.ServiceVolume{{ID: "pvc-1", MountPath: "/files"}}, nil))
	assert.Empty(t, releasedVolumes(existing, nil, []schema.ServiceVolume{{ID: "pvc-1", MountPath: "/data"}}, []schema.ServiceVolume{{ID: "pvc-1"}}))
	assert.Empty(t, releasedVolumes(existing, nil, nil, nil))
	assert.Empty(t, releasedVolumes(nil, nil, nil, []schema.ServiceVolume{{ID: "pvc-1"}}))
}

func TestSmallestVolumeMiB(t *testing.T) {
	replicas := []*models.PVCInfo{{CapacityGB: 20}, {CapacityGB: 10}}

	assert.Equal(t, int64(10240), smallestVolumeMiB(replicas, "1Gi"), "a resize the recorded size missed")
	assert.Equal(t, int64(51200), smallestVolumeMiB(replicas, "50Gi"), "a resize in the same request")
	assert.Equal(t, int64(2048), smallestVolumeMiB(nil, "2Gi"), "no claim yet")
	assert.Equal(t, int64(1024), smallestVolumeMiB(nil, ""), "nothing recorded")
}
