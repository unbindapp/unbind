package utils

// InferOperatorPVCMountPath infers the mount path for a PVC based on the operator type (database)
func InferOperatorPVCMountPath(databaseType string) *string {
	switch databaseType {
	case "postgres":
		return ToPtr("/home/postgres/pgdata")
	case "redis":
		return ToPtr("/data")
	case "mysql":
		return ToPtr("/var/lib/mysql")
	case "mongodb":
		return ToPtr("/bitnami/mongodb")
	case "clickhouse":
		return ToPtr("/var/lib/clickhouse")
	}
	return nil
}
