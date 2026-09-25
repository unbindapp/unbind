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
