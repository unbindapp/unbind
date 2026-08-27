package databases

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestStatefulSetClaimNames(t *testing.T) {
	const serviceRef = "8d1f2a3b-4c5d-6e7f-8091-a2b3c4d5e6f7"

	tests := []struct {
		name     string
		dbType   string
		crName   string
		replicas int
		expected []string
	}{
		{
			name:     "postgres single",
			dbType:   TypePostgres,
			crName:   "my-db-abc123",
			replicas: 1,
			expected: []string{"pgdata-my-db-abc123-0"},
		},
		{
			name:     "postgres replicated",
			dbType:   TypePostgres,
			crName:   "my-db-abc123",
			replicas: 3,
			expected: []string{"pgdata-my-db-abc123-0", "pgdata-my-db-abc123-1", "pgdata-my-db-abc123-2"},
		},
		{
			name:     "mysql",
			dbType:   TypeMySQL,
			crName:   "my-db-abc123",
			replicas: 2,
			expected: []string{"mysql-data-moco-my-db-abc123-0", "mysql-data-moco-my-db-abc123-1"},
		},
		{
			name:     "clickhouse",
			dbType:   TypeClickhouse,
			crName:   "my-db-abc123",
			replicas: 2,
			expected: []string{
				"clickhouse-data-chi-my-db-abc123-chi-8d1f2a3b-4c-0-0-0",
				"clickhouse-data-chi-my-db-abc123-chi-8d1f2a3b-4c-0-1-0",
			},
		},
		{
			name:     "replicas below one is treated as one",
			dbType:   TypePostgres,
			crName:   "my-db-abc123",
			replicas: 0,
			expected: []string{"pgdata-my-db-abc123-0"},
		},
		{
			name:     "engines that mount a claim by name have no template",
			dbType:   TypeRedis,
			crName:   "my-db-abc123",
			replicas: 1,
			expected: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, StatefulSetClaimNames(tt.dbType, tt.crName, serviceRef, tt.replicas))
		})
	}
}

func TestClickhouseClusterName(t *testing.T) {
	assert.Equal(t, "chi-8d1f2a3b-4c", ClickhouseClusterName("8d1f2a3b-4c5d-6e7f-8091-a2b3c4d5e6f7"))
	assert.Equal(t, "chi-short", ClickhouseClusterName("short"))
	assert.Len(t, ClickhouseClusterName("8d1f2a3b-4c5d-6e7f-8091-a2b3c4d5e6f7"), clickhouseClusterNameLimit)
}

func TestMountsExistingClaim(t *testing.T) {
	assert.True(t, MountsExistingClaim(TypeRedis))
	assert.True(t, MountsExistingClaim(TypeMongoDB))
	assert.False(t, MountsExistingClaim(TypePostgres))
	assert.False(t, MountsExistingClaim(TypeMySQL))
	assert.False(t, MountsExistingClaim(TypeClickhouse))
}
