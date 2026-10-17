package resourcebuilder

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	v1 "github.com/unbindapp/unbind-operator/api/v1"
	"github.com/unbindapp/unbind-operator/internal/resourcebuilder/networking"
	"k8s.io/utils/ptr"
)

func TestBuildDatabaseServicesTargetTheTLSPort(t *testing.T) {
	cases := map[string]struct {
		dbType string
		ports  []int32
		want   map[int32]int32
	}{
		"redis":      {"redis", []int32{6379}, map[int32]int32{6379: 6380}},
		"clickhouse": {"clickhouse", []int32{9000, 8123}, map[int32]int32{9000: 9440, 8123: 8443}},
		"postgres":   {"postgres", []int32{5432}, map[int32]int32{5432: 5432}},
		"mongodb":    {"mongodb", []int32{27017}, map[int32]int32{27017: 27017}},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			service := &v1.Service{}
			service.Name = "db-x"
			service.Spec.Name = "db-x"
			service.Spec.Type = "database"
			service.Spec.Config.Database.Type = tc.dbType
			for i, port := range tc.ports {
				service.Spec.Config.Ports = append(service.Spec.Config.Ports, v1.PortSpec{Port: port, NodePort: ptr.To(int32(30001 + i))})
			}
			provider := networking.New(networking.ProviderNginx, networking.Config{})

			services, err := NewResourceBuilder(service, nil, provider).BuildServices()
			require.NoError(t, err)
			require.Len(t, services, 1)
			assert.Equal(t, "db-x-db", services[0].Name)
			require.Len(t, services[0].Spec.Ports, len(tc.ports))
			for _, port := range services[0].Spec.Ports {
				assert.Equal(t, tc.want[port.Port], port.TargetPort.IntVal, "port %d", port.Port)
				assert.NotZero(t, port.NodePort)
			}
		})
	}
}

func TestBuildDatabaseServicesStayPrivateWithoutAnExposedPort(t *testing.T) {
	service := &v1.Service{}
	service.Spec.Type = "database"
	service.Spec.Config.Database.Type = "redis"
	service.Spec.Config.Ports = []v1.PortSpec{{Port: 6379}}

	_, err := NewResourceBuilder(service, nil, networking.New(networking.ProviderNginx, networking.Config{})).BuildServices()
	assert.ErrorIs(t, err, ErrServiceNotNeeded)
}
