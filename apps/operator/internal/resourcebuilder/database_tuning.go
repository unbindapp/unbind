package resourcebuilder

import (
	"fmt"
	"strings"

	"k8s.io/apimachinery/pkg/api/resource"
)

const (
	mebibyte = int64(1024 * 1024)
	gibibyte = 1024 * mebibyte
	// The pod memory limit is written in decimal megabytes
	megabyte = int64(1000 * 1000)
)

type databaseTuningInput struct {
	dbType                 string
	memoryLimitMegabytes   int64
	cpuLimitMillicores     int64
	storage                string
	sharedBuffersMB        int
	innodbBufferPoolSizeMB int
}

// Sizes each engine from its memory and CPU limits. Without a limit nothing is set and the
// definition defaults apply, since the engines would otherwise size themselves from the whole server.
func applyDatabaseTuning(dbConfig map[string]any, input databaseTuningInput) {
	limitBytes := input.memoryLimitMegabytes * megabyte

	switch strings.ToLower(input.dbType) {
	case "postgres":
		applyPostgresTuning(ensureMapKey(dbConfig, "postgresql"), limitBytes, input)
	case "mysql":
		applyMySQLTuning(dbConfig, limitBytes, input)
		applyMySQLRedoLog(dbConfig, input.storage)
	case "mongodb":
		applyMongoDBTuning(dbConfig, limitBytes)
	case "redis":
		applyRedisTuning(dbConfig, limitBytes)
	}
}

func applyPostgresTuning(params map[string]any, limitBytes int64, input databaseTuningInput) {
	if maxWalSizeMB := postgresMaxWalSizeMB(input.storage); maxWalSizeMB > 0 {
		params["maxWalSize"] = postgresMegabytes(maxWalSizeMB)
	}
	parallelWorkers := applyPostgresParallelism(params, input.cpuLimitMillicores)

	limitMB := limitBytes / mebibyte
	sharedBuffersMB := int64(input.sharedBuffersMB)
	if sharedBuffersMB == 0 {
		sharedBuffersMB = limitMB / 4
	}
	if sharedBuffersMB == 0 {
		return
	}
	params["sharedBuffers"] = postgresMegabytes(sharedBuffersMB)
	params["walBuffers"] = postgresMegabytes(clamp(sharedBuffersMB/32, 4, 16))

	if limitMB == 0 {
		return
	}
	params["effectiveCacheSize"] = postgresMegabytes(limitMB * 3 / 4)
	params["maintenanceWorkMem"] = postgresMegabytes(clamp(limitMB/20, 64, 1024))

	// Spilo sizes max_connections the same way, a query can use work_mem several times and
	// every parallel worker is one more process with its own work_mem
	maxConnections := clamp(limitMB/30, 100, 1000)
	processes := maxConnections + parallelWorkers
	params["workMem"] = postgresMegabytes(clamp((limitMB-sharedBuffersMB)/(processes*3), 4, 64))
}

// Parallel query stays off below two whole cores, so the default 1 CPU limit renders as before.
// The four worker slots the definition ships stay reserved for extensions and logical replication.
func applyPostgresParallelism(params map[string]any, cpuLimitMillicores int64) int64 {
	cores := cpuLimitMillicores / 1000
	if cores < 2 {
		return 0
	}
	params["maxParallelWorkers"] = fmt.Sprintf("%d", cores)
	params["maxParallelWorkersPerGather"] = fmt.Sprintf("%d", min(cores/2, 4))
	params["maxWorkerProcesses"] = fmt.Sprintf("%d", 4+cores)
	return cores
}

// WAL lives on the data volume, so it follows the volume and not the memory limit
func postgresMaxWalSizeMB(storage string) int64 {
	quantity, err := resource.ParseQuantity(storage)
	if err != nil {
		return 0
	}
	return clamp(quantity.Value()/mebibyte/10, 256, 8192)
}

func postgresMegabytes(value int64) string {
	return fmt.Sprintf("%dMB", value)
}

func applyMySQLTuning(dbConfig map[string]any, limitBytes int64, input databaseTuningInput) {
	poolBytes := int64(input.innodbBufferPoolSizeMB) * mebibyte
	if poolBytes == 0 {
		poolBytes = limitBytes / 2
	}
	if poolBytes > 0 {
		poolBytes, instances := mysqlBufferPool(poolBytes)
		dbConfig["innodbBufferPoolSize"] = fmt.Sprintf("%d", poolBytes)
		dbConfig["innodbBufferPoolInstances"] = fmt.Sprintf("%d", instances)
	}
	if limitBytes == 0 {
		return
	}
	dbConfig["maxConnections"] = fmt.Sprintf("%d", clamp(input.memoryLimitMegabytes/20, 50, 1000))
}

// The redo log is preallocated on the data volume, so it follows the volume like max_wal_size
func applyMySQLRedoLog(dbConfig map[string]any, storage string) {
	quantity, err := resource.ParseQuantity(storage)
	if err != nil {
		return
	}
	capacityBytes := clamp(quantity.Value()/20, 64*mebibyte, 2*gibibyte)
	dbConfig["innodbRedoLogCapacity"] = fmt.Sprintf("%d", capacityBytes)
}

// MySQL rounds the pool up to whole 128MB chunks per instance and picks the instances from the
// server's CPU count. Pin one instance per GB and round down, so the pool never exceeds what was asked for.
func mysqlBufferPool(poolBytes int64) (int64, int64) {
	instances := clamp(poolBytes/gibibyte, 1, 8)
	unit := 128 * mebibyte * instances
	if poolBytes >= unit {
		poolBytes -= poolBytes % unit
	}
	return max(poolBytes, 64*mebibyte), instances
}

func applyMongoDBTuning(dbConfig map[string]any, limitBytes int64) {
	if limitBytes == 0 {
		return
	}
	// MongoDB's own default: half of the memory above 1GB
	cacheGB := max(float64(limitBytes-gibibyte)/float64(gibibyte)/2, 0.25)
	dbConfig["wiredTigerCacheSizeGB"] = fmt.Sprintf("%.2f", cacheGB)
	dbConfig["maxConns"] = fmt.Sprintf("%d", clamp(limitBytes/megabyte/10, 100, 5000))
}

// The rest is headroom for the fork on save and for replication buffers
func applyRedisTuning(dbConfig map[string]any, limitBytes int64) {
	if limitBytes == 0 {
		return
	}
	dbConfig["maxMemory"] = fmt.Sprintf("%d", limitBytes*3/4)
}

func clamp(value, low, high int64) int64 {
	return min(max(value, low), high)
}
