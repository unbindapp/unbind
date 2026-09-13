package dbvolumes

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/internal/models"
)

func TestDefaultName(t *testing.T) {
	tests := []struct {
		name        string
		serviceName string
		ordinal     int
		expected    string
	}{
		{
			name:        "plain name",
			serviceName: "unb304-pg",
			expected:    "unb304-pg-volume",
		},
		{
			name:        "spaces and punctuation",
			serviceName: "My Postgres (prod)!",
			expected:    "my-postgres-prod-volume",
		},
		{
			name:        "replica",
			serviceName: "unb304-pg",
			ordinal:     2,
			expected:    "unb304-pg-volume-3",
		},
		{
			name:        "too long is cut to the rename limit",
			serviceName: "an extremely long database service name",
			expected:    "an-extremely-long-databas-volume",
		},
		{
			name:        "too long with a replica suffix",
			serviceName: "an extremely long database service name",
			ordinal:     1,
			expected:    "an-extremely-long-datab-volume-2",
		},
		{
			name:        "cut does not leave a trailing hyphen",
			serviceName: "shared postgres database cluster",
			expected:    "shared-postgres-database-volume",
		},
		{
			name:        "nothing to slugify",
			serviceName: "!!!",
			expected:    "database-volume",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := DefaultName(tt.serviceName, tt.ordinal)
			assert.Equal(t, tt.expected, got)
			assert.LessOrEqual(t, len(got), nameMaxLength)
		})
	}
}

func TestNameFromClaim(t *testing.T) {
	tests := []struct {
		name     string
		claim    string
		expected string
	}{
		{
			name:     "postgres drops the operator prefix and the unique suffix",
			claim:    "pgdata-unb304-pg-svvhvbaeroeg-0",
			expected: "unb304-pg-volume",
		},
		{
			name:     "clickhouse replica",
			claim:    "clickhouse-data-chi-ch-verify-fwcwoij97emw-chi-12b1f2f7-7a-0-1-0",
			expected: "ch-verify-volume-2",
		},
		{
			name:     "redis",
			claim:    "unb293-redis-yset0qaxuq5w",
			expected: "unb293-redis-volume",
		},
		{
			name:     "claim that is only a unique suffix keeps it",
			claim:    "pgdata-abc123def456-0",
			expected: "abc123def456-volume",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, NameFromClaim(tt.claim))
		})
	}
}

func TestResolveNames(t *testing.T) {
	serviceID := uuid.New()
	serviceNames := map[uuid.UUID]string{serviceID: "unb304-pg"}
	named := "storage for reports"

	database := &models.PVCInfo{ID: "pgdata-unb304-pg-svvhvbaeroeg-0", IsDatabase: true, MountedOnServiceID: &serviceID}
	orphaned := &models.PVCInfo{ID: "clickhouse-data-chi-ch-verify-fwcwoij97emw-chi-12b1f2f7-7a-0-0-0", IsDatabase: true}
	renamed := &models.PVCInfo{ID: "pgdata-unb293-pg-w35ubblyaxy0-0", IsDatabase: true, MountedOnServiceID: &serviceID}
	regular := &models.PVCInfo{ID: "minio-volume-21cl9ijyli5w"}

	description := "holds the reports"
	ResolveNames(
		[]*models.PVCInfo{database, orphaned, renamed, regular},
		map[string]*ent.PVCMetadata{
			renamed.ID: {Name: &named, Description: &description},
		},
		serviceNames,
	)

	assert.Equal(t, "unb304-pg-volume", database.Name)
	assert.Equal(t, "ch-verify-volume", orphaned.Name)
	assert.Equal(t, named, renamed.Name)
	assert.Equal(t, &description, renamed.Description)
	assert.Equal(t, regular.ID, regular.Name, "volumes that are not databases keep falling back to their claim")
}

func TestResolveNamesEmptyMetadataName(t *testing.T) {
	serviceID := uuid.New()
	empty := ""
	pvc := &models.PVCInfo{ID: "pgdata-unb304-pg-svvhvbaeroeg-0", IsDatabase: true, MountedOnServiceID: &serviceID}

	ResolveNames(
		[]*models.PVCInfo{pvc},
		map[string]*ent.PVCMetadata{pvc.ID: {Name: &empty}},
		map[uuid.UUID]string{serviceID: "unb304-pg"},
	)

	assert.Equal(t, "unb304-pg-volume", pvc.Name)
}
