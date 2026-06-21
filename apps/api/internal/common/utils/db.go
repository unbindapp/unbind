package utils

// InferOperatorPVCMountPath infers the mount path for a PVC based on the operator type (database)
func InferOperatorPVCMountPath(databaseType string) *string {
	switch databaseType {
	case "postgres":
		return new("/home/postgres/pgdata")
	case "redis":
		return new("/data")
	case "mysql":
		return new("/var/lib/mysql")
	case "mongodb":
		return new("/bitnami/mongodb")
	case "clickhouse":
		return new("/var/lib/clickhouse")
	}
	return nil
}
