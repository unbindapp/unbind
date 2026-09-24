package service_service

import (
	"testing"

	"github.com/stretchr/testify/assert"
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
