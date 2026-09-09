package schema

import (
	"testing"

	"github.com/stretchr/testify/assert"
	v1 "github.com/unbindapp/unbind-operator/api/v1"
)

func TestResolveResources(t *testing.T) {
	cases := map[string]struct {
		in   *Resources
		want *v1.ResourceSpec
	}{
		"nil gets the floor and no limits": {
			in:   nil,
			want: &v1.ResourceSpec{CPURequestsMillicores: 50, MemoryRequestsMegabytes: 64},
		},
		"stored request without a limit is kept": {
			in:   &Resources{CPURequestsMillicores: 30, MemoryRequestsMegabytes: 256},
			want: &v1.ResourceSpec{CPURequestsMillicores: 50, MemoryRequestsMegabytes: 256},
		},
		"limit derives the request at five percent": {
			in:   &Resources{CPULimitsMillicores: 4000, MemoryLimitsMegabytes: 8000},
			want: &v1.ResourceSpec{CPURequestsMillicores: 200, CPULimitsMillicores: 4000, MemoryRequestsMegabytes: 400, MemoryLimitsMegabytes: 8000},
		},
		"small limit lands on the floor": {
			in:   &Resources{CPULimitsMillicores: 400, MemoryLimitsMegabytes: 512},
			want: &v1.ResourceSpec{CPURequestsMillicores: 50, CPULimitsMillicores: 400, MemoryRequestsMegabytes: 64, MemoryLimitsMegabytes: 512},
		},
		"large limit hits the cap": {
			in:   &Resources{CPULimitsMillicores: 16000, MemoryLimitsMegabytes: 32000},
			want: &v1.ResourceSpec{CPURequestsMillicores: 500, CPULimitsMillicores: 16000, MemoryRequestsMegabytes: 1024, MemoryLimitsMegabytes: 32000},
		},
		"stored request above the derived value wins": {
			in:   &Resources{CPURequestsMillicores: 300, CPULimitsMillicores: 2000, MemoryRequestsMegabytes: 512, MemoryLimitsMegabytes: 2048},
			want: &v1.ResourceSpec{CPURequestsMillicores: 300, CPULimitsMillicores: 2000, MemoryRequestsMegabytes: 512, MemoryLimitsMegabytes: 2048},
		},
		"request never exceeds a limit below the floor": {
			in:   &Resources{CPURequestsMillicores: 100, CPULimitsMillicores: 30, MemoryLimitsMegabytes: 32},
			want: &v1.ResourceSpec{CPURequestsMillicores: 30, CPULimitsMillicores: 30, MemoryRequestsMegabytes: 32, MemoryLimitsMegabytes: 32},
		},
		"negative values are treated as unset": {
			in:   &Resources{CPURequestsMillicores: -1, CPULimitsMillicores: -1, MemoryRequestsMegabytes: -1, MemoryLimitsMegabytes: -1},
			want: &v1.ResourceSpec{CPURequestsMillicores: 50, MemoryRequestsMegabytes: 64},
		},
		"database default": {
			in:   DefaultDatabaseResources(),
			want: &v1.ResourceSpec{CPURequestsMillicores: 50, CPULimitsMillicores: 1000, MemoryRequestsMegabytes: 128, MemoryLimitsMegabytes: 2048},
		},
	}

	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			assert.Equal(t, tc.want, ResolveResources(tc.in))
		})
	}
}

func TestResourcesValidate(t *testing.T) {
	assert.NoError(t, (*Resources)(nil).Validate())
	assert.NoError(t, (&Resources{CPURequestsMillicores: 100, CPULimitsMillicores: 100}).Validate())
	assert.NoError(t, (&Resources{CPURequestsMillicores: 500, CPULimitsMillicores: -1}).Validate())
	assert.Error(t, (&Resources{CPURequestsMillicores: 101, CPULimitsMillicores: 100}).Validate())
	assert.Error(t, (&Resources{MemoryRequestsMegabytes: 2049, MemoryLimitsMegabytes: 2048}).Validate())
}

func TestResourcesHasNegative(t *testing.T) {
	assert.False(t, (*Resources)(nil).HasNegative())
	assert.False(t, (&Resources{CPULimitsMillicores: 100}).HasNegative())
	assert.True(t, (&Resources{MemoryLimitsMegabytes: -1}).HasNegative())
}
