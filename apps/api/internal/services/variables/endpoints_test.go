package variables_service

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	"github.com/unbindapp/unbind-api/internal/vartemplate"
)

func nodeAddress() string { return "10.0.0.7" }

func TestPublicEndpointsFor(t *testing.T) {
	nodePort := func(port, nodePort int32) schema.PortSpec {
		return schema.PortSpec{Port: port, IsNodePort: true, NodePort: utils.ToPtr(nodePort)}
	}

	t.Run("a private service is not reachable", func(t *testing.T) {
		config := &ent.ServiceConfig{Ports: []schema.PortSpec{nodePort(5432, 30001)}}
		assert.Empty(t, publicEndpointsFor(config, nodeAddress))
	})

	t.Run("a node port with no host falls back to the cluster address", func(t *testing.T) {
		config := &ent.ServiceConfig{IsPublic: true, Ports: []schema.PortSpec{nodePort(5432, 30001)}}
		endpoints := publicEndpointsFor(config, nodeAddress)
		assert.Equal(t, []serviceEndpoint{{Host: "10.0.0.7", Port: 30001, Target: 5432, L4: true}}, endpoints)
		// A bare IP is a host but not a domain, so UNBIND_DOMAIN_PUBLIC has nothing to give
		assert.False(t, endpoints[0].IsDomain)
	})

	t.Run("a host in front of a node port keeps the allocated port", func(t *testing.T) {
		config := &ent.ServiceConfig{
			IsPublic: true,
			Ports:    []schema.PortSpec{nodePort(5432, 30001)},
			Hosts:    []schema.HostSpec{{Host: "db.example.com", TargetPort: utils.ToPtr[int32](5432)}},
		}
		endpoints := publicEndpointsFor(config, nodeAddress)
		assert.Equal(t, []serviceEndpoint{{Host: "db.example.com", IsDomain: true, Port: 30001, Target: 5432, L4: true}}, endpoints)
	})

	t.Run("an http host answers on 443", func(t *testing.T) {
		config := &ent.ServiceConfig{
			IsPublic: true,
			Ports:    []schema.PortSpec{{Port: 3000}},
			Hosts:    []schema.HostSpec{{Host: "app.example.com", TargetPort: utils.ToPtr[int32](3000)}},
		}
		endpoints := publicEndpointsFor(config, nodeAddress)
		assert.Equal(t, []serviceEndpoint{{Host: "app.example.com", IsDomain: true, Port: 443, Target: 3000}}, endpoints)
	})

	t.Run("the cluster address is only resolved when something needs it", func(t *testing.T) {
		called := false
		config := &ent.ServiceConfig{
			IsPublic: true,
			Ports:    []schema.PortSpec{{Port: 3000}},
			Hosts:    []schema.HostSpec{{Host: "app.example.com", TargetPort: utils.ToPtr[int32](3000)}},
		}
		publicEndpointsFor(config, func() string { called = true; return "" })
		assert.False(t, called)
	})
}

func TestEndpointKeyNaming(t *testing.T) {
	endpoints := []serviceEndpoint{
		{Host: "a.com", Target: 3000},
		{Host: "b.com", Target: 4000},
		{Host: "c.com", Target: 4000},
	}

	assert.Equal(t, []string{
		"UNBIND_URL_PUBLIC",
		"UNBIND_URL_PUBLIC_4000",
		"UNBIND_URL_PUBLIC_4000_2",
	}, endpointKeys(vartemplate.KeyURLPublic, endpoints))

	// A single endpoint is only ever the primary, so adding a second port later
	// cannot rename the key that already exists
	assert.Equal(t, []string{"UNBIND_URL_PUBLIC"}, endpointKeys(vartemplate.KeyURLPublic, endpoints[:1]))
}

func TestSelectEndpoint(t *testing.T) {
	endpoints := []serviceEndpoint{
		{Host: "a.com", Target: 3000},
		{Host: "b.com", Target: 4000},
		{Host: "c.com", Target: 4000},
	}
	pick := func(key string) string {
		ref, ok := vartemplate.ParseEndpointKey(key)
		assert.True(t, ok)
		endpoint, ok := selectEndpoint(endpoints, ref)
		if !ok {
			return ""
		}
		return endpoint.Host
	}

	assert.Equal(t, "a.com", pick("UNBIND_URL_PUBLIC"))
	assert.Equal(t, "b.com", pick("UNBIND_URL_PUBLIC_4000"))
	assert.Equal(t, "c.com", pick("UNBIND_URL_PUBLIC_4000_2"))
	assert.Equal(t, "", pick("UNBIND_URL_PUBLIC_4000_3"))
	assert.Equal(t, "", pick("UNBIND_URL_PUBLIC_9999"))
	// Legacy keys still select by position
	assert.Equal(t, "b.com", pick("UNBIND_EXTERNAL_URL_2"))
}
