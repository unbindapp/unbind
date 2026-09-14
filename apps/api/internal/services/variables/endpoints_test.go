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

	postgres := func(config *ent.ServiceConfig) []serviceEndpoint {
		return publicEndpointsFor(schema.ServiceTypeDatabase, "postgres", config, nodeAddress)
	}
	app := func(config *ent.ServiceConfig) []serviceEndpoint {
		return publicEndpointsFor(schema.ServiceTypeGithub, "", config, nodeAddress)
	}

	t.Run("a private service is not reachable", func(t *testing.T) {
		config := &ent.ServiceConfig{Ports: []schema.PortSpec{nodePort(5432, 30001)}}
		assert.Empty(t, postgres(config))
	})

	t.Run("a node port with no host falls back to the cluster address", func(t *testing.T) {
		config := &ent.ServiceConfig{IsPublic: true, Ports: []schema.PortSpec{nodePort(5432, 30001)}}
		endpoints := postgres(config)
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
		assert.Equal(t, []serviceEndpoint{{Host: "db.example.com", IsDomain: true, Port: 30001, Target: 5432, L4: true}}, postgres(config))
	})

	t.Run("an http host answers on 443", func(t *testing.T) {
		config := &ent.ServiceConfig{
			IsPublic: true,
			Ports:    []schema.PortSpec{{Port: 3000}},
			Hosts:    []schema.HostSpec{{Host: "app.example.com", TargetPort: utils.ToPtr[int32](3000)}},
		}
		assert.Equal(t, []serviceEndpoint{{Host: "app.example.com", IsDomain: true, Port: 443, Target: 3000}}, app(config))
	})

	// Nothing routes a database over HTTP, so a domain with no node port behind it
	// reaches nothing and must not be named
	t.Run("a database host with no node port behind it is dropped", func(t *testing.T) {
		config := &ent.ServiceConfig{
			IsPublic: true,
			Ports:    []schema.PortSpec{nodePort(9000, 32368), {Port: 8123}},
			Hosts:    []schema.HostSpec{{Host: "ch.example.com", TargetPort: utils.ToPtr[int32](8123)}},
		}
		endpoints := publicEndpointsFor(schema.ServiceTypeDatabase, "clickhouse", config, nodeAddress)
		assert.Equal(t, []serviceEndpoint{{Host: "10.0.0.7", Port: 32368, Target: 9000, L4: true}}, endpoints)
	})

	t.Run("the primary protocol comes first whatever order the ports are in", func(t *testing.T) {
		config := &ent.ServiceConfig{
			IsPublic: true,
			Ports:    []schema.PortSpec{nodePort(8123, 30002), nodePort(9000, 30001)},
		}
		endpoints := publicEndpointsFor(schema.ServiceTypeDatabase, "clickhouse", config, nodeAddress)
		assert.Equal(t, []serviceEndpoint{
			{Host: "10.0.0.7", Port: 30001, Target: 9000, L4: true},
			{Host: "10.0.0.7", Port: 30002, Target: 8123, Label: "HTTP", L4: true},
		}, endpoints)
	})

	t.Run("the cluster address is only resolved when something needs it", func(t *testing.T) {
		called := false
		config := &ent.ServiceConfig{
			IsPublic: true,
			Ports:    []schema.PortSpec{{Port: 3000}},
			Hosts:    []schema.HostSpec{{Host: "app.example.com", TargetPort: utils.ToPtr[int32](3000)}},
		}
		publicEndpointsFor(schema.ServiceTypeGithub, "", config, func() string { called = true; return "" })
		assert.False(t, called)
	})
}

func TestPrivateEndpointsFor(t *testing.T) {
	// The config stores ClickHouse HTTP first on databases that predate the native
	// port, and the keys have to read the same either way
	config := &ent.ServiceConfig{Ports: []schema.PortSpec{{Port: 8123}, {Port: 9000}}}
	endpoints := privateEndpointsFor(schema.ServiceTypeDatabase, "clickhouse", config, "ch.svc")
	assert.Equal(t, []serviceEndpoint{
		{Host: "ch.svc", IsDomain: true, Port: 9000, Target: 9000},
		{Host: "ch.svc", IsDomain: true, Port: 8123, Target: 8123, Label: "HTTP"},
	}, endpoints)

	assert.Equal(t, []string{"UNBIND_PORT_PRIVATE", "UNBIND_PORT_PRIVATE_HTTP"},
		endpointKeys(vartemplate.KeyPortPrivate, endpoints))
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

	// A protocol names its endpoint wherever it sits, so the bare key never means
	// HTTP on one install and the native protocol on another
	labelled := []serviceEndpoint{
		{Host: "ch.example.com", Target: 8123, Label: "HTTP"},
		{Host: "10.0.0.7", Target: 9000},
	}
	assert.Equal(t, []string{
		"UNBIND_DATABASE_URL_PUBLIC_HTTP",
		"UNBIND_DATABASE_URL_PUBLIC",
	}, endpointKeys(vartemplate.KeyDatabaseURLPublic, labelled))
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

func TestSelectEndpointByProtocol(t *testing.T) {
	endpoints := []serviceEndpoint{
		{Host: "native.example.com", Target: 9000},
		{Host: "http.example.com", Target: 8123, Label: "HTTP"},
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

	assert.Equal(t, "native.example.com", pick("UNBIND_DATABASE_URL_PUBLIC"))
	assert.Equal(t, "http.example.com", pick("UNBIND_DATABASE_URL_PUBLIC_HTTP"))
	// The keys written before protocols were named still resolve
	assert.Equal(t, "http.example.com", pick("UNBIND_DATABASE_URL_PUBLIC_8123"))
	assert.Equal(t, "native.example.com", pick("UNBIND_DATABASE_URL_PUBLIC_9000"))

	// The bare key is the primary protocol, so it gives nothing when only the
	// secondary one is reachable
	onlyHTTP := endpoints[1:]
	ref, _ := vartemplate.ParseEndpointKey("UNBIND_DATABASE_URL_PUBLIC")
	_, ok := selectEndpoint(onlyHTTP, ref)
	assert.False(t, ok)
}
