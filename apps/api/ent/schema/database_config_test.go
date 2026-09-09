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
