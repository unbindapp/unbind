package resourcebuilder

import (
	"testing"

	"github.com/stretchr/testify/assert"
	v1 "github.com/unbindapp/unbind-operator/api/v1"
	"k8s.io/apimachinery/pkg/api/resource"
)

func TestApplyDbCommonConfigResources(t *testing.T) {
	service := &v1.Service{}
	service.Spec.Config.Database.Type = "postgres"
	service.Spec.Config.Resources = &v1.ResourceSpec{
		CPURequestsMillicores:   50,
		MemoryRequestsMegabytes: 128,
		MemoryLimitsMegabytes:   2048,
	}
	rb := NewResourceBuilder(service, nil, nil)

	dbConfig := map[string]any{}
	rb.applyDbCommonConfig(dbConfig, "1Gi")

	resources := dbConfig["common"].(map[string]any)["resources"].(map[string]any)
	assert.Equal(t, map[string]string{"cpu": "50m", "memory": "128M"}, resources["requests"])
	assert.Equal(t, map[string]string{"memory": "2048M"}, resources["limits"])
}

func TestApplyDatabaseTuning(t *testing.T) {
	tests := []struct {
		name     string
		input    databaseTuningInput
		expected map[string]any
	}{
		{
			name:  "postgres without a limit only follows the volume",
			input: databaseTuningInput{dbType: "postgres", storage: "1Gi"},
			expected: map[string]any{"postgresql": map[string]any{
				"maxWalSize": "256MB",
			}},
		},
		{
			name:  "postgres at the default limit",
			input: databaseTuningInput{dbType: "postgres", memoryLimitMegabytes: 2048, storage: "10Gi"},
			expected: map[string]any{"postgresql": map[string]any{
				"sharedBuffers":      "488MB",
				"effectiveCacheSize": "1464MB",
				"maintenanceWorkMem": "97MB",
				"walBuffers":         "15MB",
				"workMem":            "4MB",
				"maxWalSize":         "1024MB",
			}},
		},
		{
			name:  "postgres with a tiny limit keeps the floors",
			input: databaseTuningInput{dbType: "postgres", memoryLimitMegabytes: 256, storage: "1Gi"},
			expected: map[string]any{"postgresql": map[string]any{
				"sharedBuffers":      "61MB",
				"effectiveCacheSize": "183MB",
				"maintenanceWorkMem": "64MB",
				"walBuffers":         "4MB",
				"workMem":            "4MB",
				"maxWalSize":         "256MB",
			}},
		},
		{
			name:  "postgres with a large limit hits the caps",
			input: databaseTuningInput{dbType: "postgres", memoryLimitMegabytes: 65536, storage: "500Gi"},
			expected: map[string]any{"postgresql": map[string]any{
				"sharedBuffers":      "15625MB",
				"effectiveCacheSize": "46875MB",
				"maintenanceWorkMem": "1024MB",
				"walBuffers":         "16MB",
				"workMem":            "15MB",
				"maxWalSize":         "8192MB",
			}},
		},
		{
			name:  "postgres below two cores keeps parallel query off",
			input: databaseTuningInput{dbType: "postgres", memoryLimitMegabytes: 2048, cpuLimitMillicores: 1500, storage: "10Gi"},
			expected: map[string]any{"postgresql": map[string]any{
				"sharedBuffers":      "488MB",
				"effectiveCacheSize": "1464MB",
				"maintenanceWorkMem": "97MB",
				"walBuffers":         "15MB",
				"workMem":            "4MB",
				"maxWalSize":         "1024MB",
			}},
		},
		{
			name:  "postgres with four cores runs parallel queries",
			input: databaseTuningInput{dbType: "postgres", memoryLimitMegabytes: 2048, cpuLimitMillicores: 4000, storage: "10Gi"},
			expected: map[string]any{"postgresql": map[string]any{
				"sharedBuffers":               "488MB",
				"effectiveCacheSize":          "1464MB",
				"maintenanceWorkMem":          "97MB",
				"walBuffers":                  "15MB",
				"workMem":                     "4MB",
				"maxWalSize":                  "1024MB",
				"maxParallelWorkers":          "4",
				"maxParallelWorkersPerGather": "2",
				"maxWorkerProcesses":          "8",
			}},
		},
		{
			name:  "postgres with many cores caps the workers per gather and pays for them in work_mem",
			input: databaseTuningInput{dbType: "postgres", memoryLimitMegabytes: 16384, cpuLimitMillicores: 16000, storage: "100Gi"},
			expected: map[string]any{"postgresql": map[string]any{
				"sharedBuffers":               "3906MB",
				"effectiveCacheSize":          "11718MB",
				"maintenanceWorkMem":          "781MB",
				"walBuffers":                  "16MB",
				"workMem":                     "7MB",
				"maxWalSize":                  "8192MB",
				"maxParallelWorkers":          "16",
				"maxParallelWorkersPerGather": "4",
				"maxWorkerProcesses":          "20",
			}},
		},
		{
			name:  "postgres cores without a memory limit only set the workers",
			input: databaseTuningInput{dbType: "postgres", cpuLimitMillicores: 2000, storage: "1Gi"},
			expected: map[string]any{"postgresql": map[string]any{
				"maxWalSize":                  "256MB",
				"maxParallelWorkers":          "2",
				"maxParallelWorkersPerGather": "1",
				"maxWorkerProcesses":          "6",
			}},
		},
		{
			name:  "postgres override wins over the derived value",
			input: databaseTuningInput{dbType: "postgres", memoryLimitMegabytes: 8192, storage: "1Gi", sharedBuffersMB: 3072},
			expected: map[string]any{"postgresql": map[string]any{
				"sharedBuffers":      "3072MB",
				"effectiveCacheSize": "5859MB",
				"maintenanceWorkMem": "390MB",
				"walBuffers":         "16MB",
				"workMem":            "6MB",
				"maxWalSize":         "256MB",
			}},
		},
		{
			name:  "postgres override without a limit",
			input: databaseTuningInput{dbType: "postgres", storage: "1Gi", sharedBuffersMB: 512},
			expected: map[string]any{"postgresql": map[string]any{
				"sharedBuffers": "512MB",
				"walBuffers":    "16MB",
				"maxWalSize":    "256MB",
			}},
		},
		{
			name:     "mysql without a limit",
			input:    databaseTuningInput{dbType: "mysql"},
			expected: map[string]any{},
		},
		{
			name:  "mysql at the default limit rounds down to whole chunks",
			input: databaseTuningInput{dbType: "mysql", memoryLimitMegabytes: 2048},
			expected: map[string]any{
				"innodbBufferPoolSize":      "939524096",
				"innodbBufferPoolInstances": "1",
				"maxConnections":            "102",
			},
		},
		{
			name:     "mysql redo log keeps the floor on the default volume",
			input:    databaseTuningInput{dbType: "mysql", storage: "1Gi"},
			expected: map[string]any{"innodbRedoLogCapacity": "67108864"},
		},
		{
			name:     "mysql redo log follows the volume",
			input:    databaseTuningInput{dbType: "mysql", storage: "30Gi"},
			expected: map[string]any{"innodbRedoLogCapacity": "1610612736"},
		},
		{
			name:     "mysql redo log hits the cap on a large volume",
			input:    databaseTuningInput{dbType: "mysql", storage: "500Gi"},
			expected: map[string]any{"innodbRedoLogCapacity": "2147483648"},
		},
		{
			name:     "mysql cores change nothing",
			input:    databaseTuningInput{dbType: "mysql", cpuLimitMillicores: 8000},
			expected: map[string]any{},
		},
		{
			name:  "mysql with a tiny limit keeps the floors",
			input: databaseTuningInput{dbType: "mysql", memoryLimitMegabytes: 100},
			expected: map[string]any{
				"innodbBufferPoolSize":      "67108864",
				"innodbBufferPoolInstances": "1",
				"maxConnections":            "50",
			},
		},
		{
			name:  "mysql override rounds down to whole chunks",
			input: databaseTuningInput{dbType: "mysql", memoryLimitMegabytes: 8192, innodbBufferPoolSizeMB: 6000},
			expected: map[string]any{
				"innodbBufferPoolSize":      "6039797760",
				"innodbBufferPoolInstances": "5",
				"maxConnections":            "409",
			},
		},
		{
			name:  "mysql override without a limit",
			input: databaseTuningInput{dbType: "mysql", innodbBufferPoolSizeMB: 512},
			expected: map[string]any{
				"innodbBufferPoolSize":      "536870912",
				"innodbBufferPoolInstances": "1",
			},
		},
		{
			name:     "mongodb without a limit",
			input:    databaseTuningInput{dbType: "mongodb"},
			expected: map[string]any{},
		},
		{
			name:  "mongodb at the default limit",
			input: databaseTuningInput{dbType: "mongodb", memoryLimitMegabytes: 2048},
			expected: map[string]any{
				"wiredTigerCacheSizeGB": "0.45",
				"maxConns":              "204",
			},
		},
		{
			name:  "mongodb below 1GB keeps the floor",
			input: databaseTuningInput{dbType: "mongodb", memoryLimitMegabytes: 512},
			expected: map[string]any{
				"wiredTigerCacheSizeGB": "0.25",
				"maxConns":              "100",
			},
		},
		{
			name:     "redis without a limit",
			input:    databaseTuningInput{dbType: "redis"},
			expected: map[string]any{},
		},
		{
			name:     "redis at the default limit",
			input:    databaseTuningInput{dbType: "redis", memoryLimitMegabytes: 2048},
			expected: map[string]any{"maxMemory": "1536000000"},
		},
		{
			name:     "clickhouse is left alone",
			input:    databaseTuningInput{dbType: "clickhouse", memoryLimitMegabytes: 2048, cpuLimitMillicores: 4000, storage: "10Gi"},
			expected: map[string]any{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dbConfig := map[string]any{}
			applyDatabaseTuning(dbConfig, tt.input)
			assert.Equal(t, tt.expected, dbConfig)
		})
	}
}

func TestBuildDatabaseConfigKeepsOverridesOutOfTheParameters(t *testing.T) {
	service := &v1.Service{}
	service.Spec.Config.Database.Type = "postgres"
	service.Spec.Config.Database.Config = &v1.DatabaseConfigSpec{SharedBuffersMB: 300}
	service.Spec.Config.Resources = &v1.ResourceSpec{MemoryLimitsMegabytes: 2048}
	rb := NewResourceBuilder(service, nil, nil)

	dbConfig := rb.buildDatabaseConfig("")

	assert.NotContains(t, dbConfig, "sharedBuffersMb")
	assert.Equal(t, "300MB", dbConfig["postgresql"].(map[string]any)["sharedBuffers"])
}

func TestBuildDatabaseConfigSizesParallelismFromTheCPULimit(t *testing.T) {
	service := &v1.Service{}
	service.Spec.Config.Database.Type = "postgres"
	service.Spec.Config.Resources = &v1.ResourceSpec{CPULimitsMillicores: 4000}
	rb := NewResourceBuilder(service, nil, nil)

	params := rb.buildDatabaseConfig("")["postgresql"].(map[string]any)

	assert.Equal(t, "4", params["maxParallelWorkers"])
	assert.Equal(t, "2", params["maxParallelWorkersPerGather"])
	assert.Equal(t, "8", params["maxWorkerProcesses"])
}

func TestBuildDatabaseConfigSizesRedoLogFromTheRealVolume(t *testing.T) {
	service := &v1.Service{}
	service.Spec.Config.Database.Type = "mysql"
	rb := NewResourceBuilder(service, nil, nil)

	assert.Equal(t, "67108864", rb.buildDatabaseConfig("")["innodbRedoLogCapacity"])
	assert.Equal(t, "1610612736", rb.buildDatabaseConfig("30Gi")["innodbRedoLogCapacity"])
}

func TestBuildDatabaseConfigSizesWalFromTheRealVolume(t *testing.T) {
	service := &v1.Service{}
	service.Spec.Config.Database.Type = "postgres"
	storage := resource.MustParse("1Gi")
	service.Spec.Config.Database.Config = &v1.DatabaseConfigSpec{StorageSize: &storage}
	rb := NewResourceBuilder(service, nil, nil)

	unbound := rb.buildDatabaseConfig("")
	assert.Equal(t, "256MB", unbound["postgresql"].(map[string]any)["maxWalSize"])

	resized := rb.buildDatabaseConfig("30Gi")
	assert.Equal(t, "3072MB", resized["postgresql"].(map[string]any)["maxWalSize"])
	assert.Equal(t, "1Gi", resized["common"].(map[string]any)["storage"], "the claim template keeps the recorded size")
}
