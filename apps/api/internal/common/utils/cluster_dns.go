package utils

import "fmt"

const clusterServiceDomain = "svc.cluster.local"

func ServiceFQDN(name, namespace string) string {
	return fmt.Sprintf("%s.%s.%s", name, namespace, clusterServiceDomain)
}
