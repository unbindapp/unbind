package databases

import "fmt"

const (
	TypePostgres   = "postgres"
	TypeMySQL      = "mysql"
	TypeClickhouse = "clickhouse"
	TypeRedis      = "redis"
	TypeMongoDB    = "mongodb"
)

const clickhouseClusterNameLimit = 15

// Altinity derives its StatefulSet names from the cluster name, so claim names depend on it too
func ClickhouseClusterName(serviceRef string) string {
	name := fmt.Sprintf("chi-%s", serviceRef)
	if len(name) > clickhouseClusterNameLimit {
		return name[:clickhouseClusterNameLimit]
	}
	return name
}

func MountsExistingClaim(dbType string) bool {
	switch dbType {
	case TypeRedis, TypeMongoDB:
		return true
	}
	return false
}

// the StatefulSet controller adopts pre-created claims: it creates only on IsNotFound and
// never updates an existing claim's spec (kubernetes stateful_pod_control.go)
func StatefulSetClaimNames(dbType, crName, serviceRef string, replicas int) []string {
	if replicas < 1 {
		replicas = 1
	}

	var format string
	switch dbType {
	case TypePostgres:
		format = "pgdata-" + crName + "-%d"
	case TypeMySQL:
		format = "mysql-data-moco-" + crName + "-%d"
	case TypeClickhouse:
		format = fmt.Sprintf("clickhouse-data-chi-%s-%s-0-%%d-0", crName, ClickhouseClusterName(serviceRef))
	default:
		return nil
	}

	names := make([]string, replicas)
	for i := range names {
		names[i] = fmt.Sprintf(format, i)
	}
	return names
}
