package variables_service

import (
	"context"
	"sort"

	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	"github.com/unbindapp/unbind-api/internal/infrastructure/k8s"
	"github.com/unbindapp/unbind-api/internal/vartemplate"
	"github.com/unbindapp/unbind-api/pkg/databases"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// httpsPort is the port an ingress-routed host answers on
const httpsPort int32 = 443

// serviceEndpoint is one address a service can be reached at. Target is the
// container port the endpoint fronts and is what suffixes the endpoint key, so
// UNBIND_URL_PRIVATE_8080 and UNBIND_URL_PUBLIC_8080 name the same logical port.
type serviceEndpoint struct {
	Host     string
	IsDomain bool
	Port     int32
	Target   int32
	L4       bool
}

// privateEndpoints lists the in-cluster addresses of a service, one per TCP port
func privateEndpoints(service *ent.Service, namespace string) []serviceEndpoint {
	host := utils.ServiceFQDN(utils.InternalServiceName(databaseType(service), service.KubernetesName), namespace)
	return privateEndpointsFor(service.Type, service.Edges.ServiceConfig, host)
}

// privateEndpointsFor is the config-only form, used where only the shape of the
// endpoints matters and the address does not
func privateEndpointsFor(serviceType schema.ServiceType, config *ent.ServiceConfig, host string) []serviceEndpoint {
	ports := configInternalPorts(serviceType, config)
	endpoints := make([]serviceEndpoint, 0, len(ports))
	for _, port := range ports {
		endpoints = append(endpoints, serviceEndpoint{
			Host:     host,
			IsDomain: true,
			Port:     port,
			Target:   port,
		})
	}
	return endpoints
}

// publicEndpoints lists the internet-facing addresses of a service. Hosts come
// first so the primary key resolves to a domain when the service has one, falling
// back to the cluster's own address for raw L4 ports that no host fronts.
func publicEndpoints(service *ent.Service, clusterAddress func() string) []serviceEndpoint {
	return publicEndpointsFor(service.Edges.ServiceConfig, clusterAddress)
}

// clusterAddress is resolved lazily: a service whose ports are all fronted by a host
// never needs to know the cluster's own address.
func publicEndpointsFor(config *ent.ServiceConfig, clusterAddress func() string) []serviceEndpoint {
	if config == nil || !config.IsPublic {
		return nil
	}

	nodePorts := make(map[int32]int32)
	for _, port := range config.Ports {
		if port.IsNodePort && port.NodePort != nil {
			nodePorts[port.Port] = *port.NodePort
		}
	}

	var endpoints []serviceEndpoint
	fronted := make(map[int32]struct{})
	for _, host := range config.Hosts {
		endpoint := serviceEndpoint{Host: host.Host, IsDomain: true, Port: httpsPort}
		if host.TargetPort != nil {
			endpoint.Target = *host.TargetPort
			if nodePort, ok := nodePorts[*host.TargetPort]; ok {
				endpoint.Port = nodePort
				endpoint.L4 = true
			}
			fronted[*host.TargetPort] = struct{}{}
		}
		endpoints = append(endpoints, endpoint)
	}

	// A node port with no host is reached at the cluster's own address
	targets := make([]int32, 0, len(nodePorts))
	for target := range nodePorts {
		if _, ok := fronted[target]; ok {
			continue
		}
		targets = append(targets, target)
	}
	if len(targets) == 0 {
		return endpoints
	}
	address := clusterAddress()
	if address == "" {
		return endpoints
	}
	sort.Slice(targets, func(i, j int) bool { return targets[i] < targets[j] })
	for _, target := range targets {
		endpoints = append(endpoints, serviceEndpoint{
			Host:   address,
			Port:   nodePorts[target],
			Target: target,
			L4:     true,
		})
	}

	return endpoints
}

// selectEndpoint picks the endpoint a parsed key refers to. An unsuffixed key is
// the primary endpoint, a port suffix selects by container port, and legacy keys
// select by their original position.
func selectEndpoint(endpoints []serviceEndpoint, ref vartemplate.EndpointRef) (serviceEndpoint, bool) {
	if len(endpoints) == 0 {
		return serviceEndpoint{}, false
	}
	if ref.Legacy {
		if ref.Index > len(endpoints) {
			return serviceEndpoint{}, false
		}
		return endpoints[ref.Index-1], true
	}
	if ref.Port == 0 {
		return endpoints[0], true
	}

	seen := 0
	tiebreak := max(ref.Tiebreak, 1)
	for _, endpoint := range endpoints {
		if endpoint.Target != ref.Port {
			continue
		}
		seen++
		if seen == tiebreak {
			return endpoint, true
		}
	}
	return serviceEndpoint{}, false
}

// endpointKeys names every key that resolves for a set of endpoints: the bare key
// for the primary one, then a port-suffixed key each, with a tiebreaker where two
// endpoints share a container port.
func endpointKeys(base string, endpoints []serviceEndpoint) []string {
	if len(endpoints) == 0 {
		return nil
	}
	keys := []string{base}
	if len(endpoints) == 1 {
		return keys
	}
	for index := range endpoints {
		if key := endpointKeyAt(base, endpoints, index); key != base {
			keys = append(keys, key)
		}
	}
	return keys
}

// endpointKeyAt names one endpoint of a set. The first is the primary and keeps the
// bare base; the rest are named by container port, with a tiebreaker where two
// endpoints share one.
func endpointKeyAt(base string, endpoints []serviceEndpoint, index int) string {
	if index <= 0 || index >= len(endpoints) || endpoints[index].Target == 0 {
		return base
	}
	target := endpoints[index].Target
	tiebreak := 0
	for _, endpoint := range endpoints[:index+1] {
		if endpoint.Target == target {
			tiebreak++
		}
	}
	return vartemplate.EndpointKey(base, target, tiebreak)
}

// ClusterAddress is the address that reaches raw L4 ports from outside: the load
// balancer in front of the gateway, or any node otherwise. Resolve it once per
// render or request, it talks to the cluster.
func ClusterAddress(ctx context.Context, client k8s.KubeClientInterface) string {
	if client.NetworkingProvider(ctx) == "gateway" {
		lb, err := client.GetActiveControllerIP(ctx)
		if err != nil {
			log.Warnf("Failed to resolve the gateway address for endpoint variables: %v", err)
			return ""
		}
		if lb.IPv4 != "" {
			return lb.IPv4
		}
		return lb.IPv6
	}

	nodes, err := client.GetInternalClient().CoreV1().Nodes().List(ctx, metav1.ListOptions{})
	if err != nil {
		log.Warnf("Failed to list nodes for endpoint variables: %v", err)
		return ""
	}
	// Sorted by name so the address stays the same between renders
	sort.Slice(nodes.Items, func(i, j int) bool { return nodes.Items[i].Name < nodes.Items[j].Name })

	var internal string
	for _, node := range nodes.Items {
		for _, address := range node.Status.Addresses {
			if address.Type == corev1.NodeExternalIP && address.Address != "" {
				return address.Address
			}
			if address.Type == corev1.NodeInternalIP && internal == "" {
				internal = address.Address
			}
		}
	}
	return internal
}

// databaseConnection reads the credentials a database's connection strings are
// built from. Everything else about the string comes from the engine and the config.
func databaseConnection(service *ent.Service, secret map[string][]byte) databases.Connection {
	conn := databases.Connection{
		Type:     databaseType(service),
		Username: string(secret["DATABASE_USERNAME"]),
		Password: string(secret["DATABASE_PASSWORD"]),
		Database: string(secret["DATABASE_DEFAULT_DB_NAME"]),
	}
	if conn.Database == "" && service.Edges.ServiceConfig != nil && service.Edges.ServiceConfig.DatabaseConfig != nil {
		conn.Database = service.Edges.ServiceConfig.DatabaseConfig.DefaultDatabaseName
	}
	return conn
}

// Keys Unbind used to store on a database before its addresses were computed. They
// resolve to the computed equivalent so references written against the old names
// keep working; they are simply no longer rows anyone can see or write.
var legacyDatabaseKeys = map[string]func(databaseType string) string{
	"DATABASE_URL":  func(string) string { return vartemplate.KeyDatabaseURLPrivate },
	"DATABASE_HOST": func(string) string { return vartemplate.KeyHostPrivate },
	"DATABASE_PORT": func(string) string { return vartemplate.KeyPortPrivate },
	"DATABASE_HTTP_URL": func(databaseType string) string {
		return vartemplate.EndpointKey(vartemplate.KeyDatabaseURLPrivate, databases.DefaultHTTPPort(databaseType), 1)
	},
	"DATABASE_HTTP_PORT": func(databaseType string) string {
		return vartemplate.EndpointKey(vartemplate.KeyPortPrivate, databases.DefaultHTTPPort(databaseType), 1)
	},
}

// LegacyDatabaseKey maps a key Unbind used to store to the endpoint key that
// replaced it, empty when the key is not one of them
func LegacyDatabaseKey(service *ent.Service, key string) string {
	resolve, ok := legacyDatabaseKeys[key]
	if !ok || !isDatabase(service) {
		return ""
	}
	return resolve(databaseType(service))
}

func isDatabase(service *ent.Service) bool {
	return service.Type == schema.ServiceTypeDatabase
}
