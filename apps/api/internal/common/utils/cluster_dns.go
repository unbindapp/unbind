package utils

import "fmt"

const clusterServiceDomain = "svc.cluster.local"

func ServiceFQDN(name, namespace string) string {
	return fmt.Sprintf("%s.%s.%s", name, namespace, clusterServiceDomain)
}

// InternalServiceName is the Kubernetes Service a client connects to for a
// service. Database operators front their pods with their own naming scheme.
func InternalServiceName(databaseType, kubernetesName string) string {
	switch databaseType {
	case "mysql":
		return fmt.Sprintf("moco-%s-primary", kubernetesName)
	case "redis":
		return fmt.Sprintf("%s-headless", kubernetesName)
	case "clickhouse":
		return fmt.Sprintf("clickhouse-%s", kubernetesName)
	default:
		return kubernetesName
	}
}
