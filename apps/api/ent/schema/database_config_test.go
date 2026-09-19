package schema

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestMergeDatabaseConfig(t *testing.T) {
	ten, twenty, zero := 10, 20, 0
	existing := &DatabaseConfig{
		Version:             "17",
		StorageSize:         "5Gi",
		DefaultDatabaseName: "postgres",
		InitDB:              "create publication p;",
		WalLevel:            WalLevelReplica,
		MaxReplicationSlots: &ten,
	}

	cases := map[string]struct {
		existing *DatabaseConfig
		patch    *DatabaseConfig
		want     *DatabaseConfig
	}{
		"nil patch keeps existing": {existing, nil, existing},
		"nil existing takes the patch": {
			nil,
			&DatabaseConfig{WalLevel: WalLevelLogical},
			&DatabaseConfig{WalLevel: WalLevelLogical},
		},
		"unset fields keep the stored values": {
			existing,
			&DatabaseConfig{WalLevel: WalLevelLogical, MaxWalSenders: &twenty},
			&DatabaseConfig{
				Version:             "17",
				StorageSize:         "5Gi",
				DefaultDatabaseName: "postgres",
				InitDB:              "create publication p;",
				WalLevel:            WalLevelLogical,
				MaxReplicationSlots: &ten,
				MaxWalSenders:       &twenty,
			},
		},
		"explicit zero resets a number": {
			existing,
			&DatabaseConfig{MaxReplicationSlots: &zero},
			&DatabaseConfig{
				Version:             "17",
				StorageSize:         "5Gi",
				DefaultDatabaseName: "postgres",
				InitDB:              "create publication p;",
				WalLevel:            WalLevelReplica,
				MaxReplicationSlots: &zero,
			},
		},
	}

	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			assert.Equal(t, tc.want, MergeDatabaseConfig(tc.existing, tc.patch))
		})
	}
}

func TestDatabaseConfigAsV1CarriesReplicationSettings(t *testing.T) {
	twenty := 20
	spec, err := (&DatabaseConfig{
		WalLevel:      WalLevelLogical,
		MaxWalSenders: &twenty,
	}).AsV1DatabaseConfig()
	assert.NoError(t, err)
	assert.Equal(t, "logical", spec.WalLevel)
	assert.Equal(t, 20, spec.MaxWalSenders)
	assert.Equal(t, 0, spec.MaxReplicationSlots)
	assert.Equal(t, 0, spec.MaxSlotWalKeepSizeMB)
}

func TestMergeDatabaseConfigCarriesCacheOverrides(t *testing.T) {
	stored, patched, zero := 512, 1024, 0
	existing := &DatabaseConfig{SharedBuffersMB: &stored, InnodbBufferPoolSizeMB: &stored}

	assert.Equal(t,
		&DatabaseConfig{SharedBuffersMB: &patched, InnodbBufferPoolSizeMB: &stored},
		MergeDatabaseConfig(existing, &DatabaseConfig{SharedBuffersMB: &patched}),
	)
	assert.Equal(t,
		&DatabaseConfig{SharedBuffersMB: &stored, InnodbBufferPoolSizeMB: &zero},
		MergeDatabaseConfig(existing, &DatabaseConfig{InnodbBufferPoolSizeMB: &zero}),
	)
}

func TestDatabaseConfigValidateMemorySettings(t *testing.T) {
	limited := &Resources{MemoryLimitsMegabytes: 2048}

	cases := map[string]struct {
		config       *DatabaseConfig
		databaseType string
		resources    *Resources
		wantErr      string
	}{
		"nil config":                        {nil, "postgres", limited, ""},
		"zero means automatic":              {&DatabaseConfig{SharedBuffersMB: new(0), InnodbBufferPoolSizeMB: new(0)}, "redis", limited, ""},
		"shared buffers at half the limit":  {&DatabaseConfig{SharedBuffersMB: new(976)}, "postgres", limited, ""},
		"shared buffers above half":         {&DatabaseConfig{SharedBuffersMB: new(977)}, "postgres", limited, "cannot exceed 976"},
		"shared buffers without a limit":    {&DatabaseConfig{SharedBuffersMB: new(8192)}, "postgres", nil, ""},
		"shared buffers too small":          {&DatabaseConfig{SharedBuffersMB: new(15)}, "postgres", limited, "at least 16"},
		"shared buffers on mysql":           {&DatabaseConfig{SharedBuffersMB: new(256)}, "mysql", limited, "only applies to postgres"},
		"buffer pool at three quarters":     {&DatabaseConfig{InnodbBufferPoolSizeMB: new(1464)}, "mysql", limited, ""},
		"buffer pool above three quarters":  {&DatabaseConfig{InnodbBufferPoolSizeMB: new(1465)}, "mysql", limited, "cannot exceed 1464"},
		"buffer pool on postgres":           {&DatabaseConfig{InnodbBufferPoolSizeMB: new(256)}, "postgres", limited, "only applies to mysql"},
		"override outgrows a lowered limit": {&DatabaseConfig{SharedBuffersMB: new(976)}, "postgres", &Resources{MemoryLimitsMegabytes: 1024}, "cannot exceed 488"},
	}

	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			err := tc.config.ValidateMemorySettings(tc.databaseType, tc.resources)
			if tc.wantErr == "" {
				assert.NoError(t, err)
				return
			}
			assert.ErrorContains(t, err, tc.wantErr)
		})
	}
}

func TestMergeResources(t *testing.T) {
	existing := &Resources{CPULimitsMillicores: 1000, MemoryLimitsMegabytes: 2048}

	assert.Equal(t, existing, MergeResources(existing, nil))
	assert.Equal(t,
		&Resources{CPULimitsMillicores: 1000, MemoryLimitsMegabytes: 4096},
		MergeResources(existing, &Resources{MemoryLimitsMegabytes: 4096}),
	)
	assert.Equal(t,
		&Resources{CPULimitsMillicores: 1000},
		MergeResources(existing, &Resources{MemoryLimitsMegabytes: -1}),
	)
	assert.Nil(t, MergeResources(existing, &Resources{CPULimitsMillicores: -1, MemoryLimitsMegabytes: -1}))
}
