package service_service

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/unbindapp/unbind-api/ent/schema"
)

func TestResolveIsPublic(t *testing.T) {
	databasePorts := []schema.PortSpec{{Port: 5432}}

	tests := []struct {
		name        string
		requested   *bool
		serviceType schema.ServiceType
		ports       []schema.PortSpec
		want        *bool
	}{
		{name: "database defaults to private", requested: nil, serviceType: schema.ServiceTypeDatabase, ports: databasePorts, want: new(false)},
		{name: "database made public on request", requested: new(true), serviceType: schema.ServiceTypeDatabase, ports: databasePorts, want: new(true)},
		{name: "database kept private on request", requested: new(false), serviceType: schema.ServiceTypeDatabase, ports: databasePorts, want: new(false)},
		{name: "service with a port defaults to public", requested: nil, serviceType: schema.ServiceTypeDockerimage, ports: []schema.PortSpec{{Port: 8080}}, want: new(true)},
		{name: "service without ports stays undecided", requested: nil, serviceType: schema.ServiceTypeDockerimage, ports: nil, want: nil},
		{name: "request wins without ports", requested: new(true), serviceType: schema.ServiceTypeDockerimage, ports: nil, want: new(true)},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			isPublic := resolveIsPublic(tt.requested, tt.serviceType, tt.ports)
			if tt.want == nil {
				assert.Nil(t, isPublic)
				return
			}
			assert.NotNil(t, isPublic)
			assert.Equal(t, *tt.want, *isPublic)
		})
	}
}

func TestResolveAutoDeploy(t *testing.T) {
	tests := []struct {
		name        string
		requested   *bool
		serviceType schema.ServiceType
		want        *bool
	}{
		{name: "github defaults to on", requested: nil, serviceType: schema.ServiceTypeGithub, want: new(true)},
		{name: "github turned off on request", requested: new(false), serviceType: schema.ServiceTypeGithub, want: new(false)},
		{name: "image stays undecided", requested: nil, serviceType: schema.ServiceTypeDockerimage, want: nil},
		{name: "database stays undecided", requested: nil, serviceType: schema.ServiceTypeDatabase, want: nil},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			autoDeploy := resolveAutoDeploy(tt.requested, tt.serviceType)
			if tt.want == nil {
				assert.Nil(t, autoDeploy)
				return
			}
			assert.NotNil(t, autoDeploy)
			assert.Equal(t, *tt.want, *autoDeploy)
		})
	}
}

func TestCleanCreateWatchPaths(t *testing.T) {
	tests := []struct {
		name        string
		serviceType schema.ServiceType
		patterns    []string
		want        []string
		wantErr     bool
	}{
		{name: "unset stays unset", serviceType: schema.ServiceTypeGithub, patterns: nil, want: nil},
		{name: "github patterns are trimmed and deduped", serviceType: schema.ServiceTypeGithub, patterns: []string{" server/** ", "", "server/**", "!server/README.md"}, want: []string{"server/**", "!server/README.md"}},
		{name: "image service is refused", serviceType: schema.ServiceTypeDockerimage, patterns: []string{"server/**"}, wantErr: true},
		{name: "database is refused", serviceType: schema.ServiceTypeDatabase, patterns: []string{"server/**"}, wantErr: true},
		{name: "too long pattern is refused", serviceType: schema.ServiceTypeGithub, patterns: []string{strings.Repeat("a", 257)}, wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cleaned, err := cleanCreateWatchPaths(tt.serviceType, tt.patterns)
			if tt.wantErr {
				assert.Error(t, err)
				return
			}
			assert.NoError(t, err)
			assert.Equal(t, tt.want, cleaned)
		})
	}
}

// A cron service built from a repo that EXPOSEs a port must not get that port, and
// with no port it gets no generated domain
func TestSkipsDetectedPortsForCron(t *testing.T) {
	hourly := "0 * * * *"
	empty := ""

	assert.True(t, skipsDetectedPorts(true, &hourly))
	assert.False(t, skipsDetectedPorts(false, &hourly), "ports the caller sent are kept")
	assert.False(t, skipsDetectedPorts(true, &empty), "an empty schedule runs continuously")
	assert.False(t, skipsDetectedPorts(true, nil))

	assert.Nil(t, resolveIsPublic(nil, schema.ServiceTypeGithub, nil))
}
