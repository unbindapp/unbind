package variables_service

import (
	"context"
	"slices"
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
// container port the endpoint fronts, so UNBIND_URL_PRIVATE_8080 and
// UNBIND_URL_PUBLIC_8080 name the same logical port. Label is the protocol the
// endpoint carries when the engine speaks more than one, and names the key instead.
type serviceEndpoint struct {
	Host     string
	IsDomain bool
	Port     int32
	Target   int32
	Label    string
	L4       bool
}

// privateEndpoints lists the in-cluster addresses of a service, one per TCP port
func privateEndpoints(service *ent.Service, namespace string) []serviceEndpoint {
	host := utils.ServiceFQDN(utils.InternalServiceName(databaseType(service), service.KubernetesName), namespace)
	return privateEndpointsFor(service.Type, databaseType(service), service.Edges.ServiceConfig, host)
}

// privateEndpointsFor is the config-only form, used where only the shape of the
// endpoints matters and the address does not
func privateEndpointsFor(serviceType schema.ServiceType, databaseType string, config *ent.ServiceConfig, host string) []serviceEndpoint {
	ports := configInternalPorts(serviceType, config)
	endpoints := make([]serviceEndpoint, 0, len(ports))
	for _, port := range ports {
		endpoints = append(endpoints, serviceEndpoint{
			Host:     host,
			IsDomain: true,
			Port:     port,
			Target:   port,
			Label:    databases.ProtocolLabel(databaseType, port),
		})
	}
	return orderByProtocol(endpoints)
}

// publicEndpoints lists the internet-facing addresses of a service. Hosts come
// before the cluster's own address, which is the fallback for raw L4 ports that no
// host fronts, and the engine's primary protocol comes before all of them.
func publicEndpoints(service *ent.Service, clusterAddress func() string) []serviceEndpoint {
	return publicEndpointsFor(service.Type, databaseType(service), service.Edges.ServiceConfig, clusterAddress)
}

// clusterAddress is resolved lazily: a service whose ports are all fronted by a host
// never needs to know the cluster's own address.
func publicEndpointsFor(serviceType schema.ServiceType, databaseType string, config *ent.ServiceConfig, clusterAddress func() string) []serviceEndpoint {
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
		var nodePort int32
		bridged := false
		if host.TargetPort != nil {
			nodePort, bridged = nodePorts[*host.TargetPort]
		}
		// Databases are never HTTP routed, so a host with no L4 bridge behind it
		// reaches nothing and must not name an endpoint
		if !bridged && serviceType == schema.ServiceTypeDatabase {
			continue
		}

		endpoint := serviceEndpoint{Host: host.Host, IsDomain: true, Port: httpsPort}
		if host.TargetPort != nil {
			endpoint.Target = *host.TargetPort
			endpoint.Label = databases.ProtocolLabel(databaseType, *host.TargetPort)
			fronted[*host.TargetPort] = struct{}{}
		}
		if bridged {
			endpoint.Port = nodePort
			endpoint.L4 = true
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
		return orderByProtocol(endpoints)
	}
	address := clusterAddress()
	if address == "" {
		return orderByProtocol(endpoints)
	}
	sort.Slice(targets, func(i, j int) bool { return targets[i] < targets[j] })
	for _, target := range targets {
		endpoints = append(endpoints, serviceEndpoint{
			Host:   address,
			Port:   nodePorts[target],
			Target: target,
			Label:  databases.ProtocolLabel(databaseType, target),
			L4:     true,
		})
	}

	return orderByProtocol(endpoints)
}

// orderByProtocol puts the engine's primary protocol first so the unsuffixed keys
// name it on both sides, whatever order the config stores its ports in. Endpoints
// that carry no protocol of their own keep the order they were built in.
func orderByProtocol(endpoints []serviceEndpoint) []serviceEndpoint {
	sort.SliceStable(endpoints, func(i, j int) bool {
		return endpoints[i].Label == "" && endpoints[j].Label != ""
	})
	return endpoints
}

// selectEndpoint picks the endpoint a parsed key refers to. An unsuffixed key is the
// primary protocol, a label selects the protocol that carries it, a port suffix
// selects by container port, and legacy keys select by their original position.
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

	tiebreak := max(ref.Tiebreak, 1)
	if ref.Label != "" {
		return nthEndpoint(endpoints, tiebreak, func(endpoint serviceEndpoint) bool {
			return endpoint.Label == ref.Label
		})
	}
	if ref.Port != 0 {
		return nthEndpoint(endpoints, tiebreak, func(endpoint serviceEndpoint) bool {
			return endpoint.Target == ref.Port
		})
	}
	return nthEndpoint(endpoints, 1, func(endpoint serviceEndpoint) bool {
		return endpoint.Label == ""
	})
}

// primaryEndpointIndex is the endpoint the bare key names: the first one carrying no
// protocol of its own, which is the engine's primary protocol
func primaryEndpointIndex(endpoints []serviceEndpoint) int {
	for index, endpoint := range endpoints {
		if endpoint.Label == "" {
			return index
		}
	}
	return -1
}

// nthEndpoint returns the nth endpoint that matches, counting from one
func nthEndpoint(endpoints []serviceEndpoint, nth int, matches func(serviceEndpoint) bool) (serviceEndpoint, bool) {
	seen := 0
	for _, endpoint := range endpoints {
		if !matches(endpoint) {
			continue
		}
		seen++
		if seen == nth {
			return endpoint, true
		}
	}
	return serviceEndpoint{}, false
}

// endpointKeys names every key that resolves for a set of endpoints: the bare key for
// the primary protocol, a labelled key for every other protocol, and a port-suffixed
// key for the ports of a service that speaks no protocol Unbind knows.
func endpointKeys(base string, endpoints []serviceEndpoint) []string {
	var keys []string
	for index := range endpoints {
		key := endpointKeyAt(base, endpoints, index)
		if !slices.Contains(keys, key) {
			keys = append(keys, key)
		}
	}
	return keys
}

// endpointKeyAt names one endpoint of a set. A labelled endpoint is named by its
// protocol wherever it sits, the first unlabelled one is the primary and keeps the
// bare base, and the rest are named by container port. Endpoints sharing a name are
// separated by a tiebreaker.
func endpointKeyAt(base string, endpoints []serviceEndpoint, index int) string {
	if index < 0 || index >= len(endpoints) {
		return base
	}
	endpoint := endpoints[index]
	if endpoint.Label == "" && (endpoint.Target == 0 || index == primaryEndpointIndex(endpoints)) {
		return base
	}
	tiebreak := 0
	for _, earlier := range endpoints[:index+1] {
		if earlier.Target == endpoint.Target {
			tiebreak++
		}
	}
	if endpoint.Label != "" {
		return vartemplate.EndpointKey(base, endpoint.Label, tiebreak)
	}
	return vartemplate.EndpointKey(base, vartemplate.PortSuffix(endpoint.Target), tiebreak)
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
		return vartemplate.EndpointKey(vartemplate.KeyDatabaseURLPrivate, httpLabel(databaseType), 1)
	},
	"DATABASE_HTTP_PORT": func(databaseType string) string {
		return vartemplate.EndpointKey(vartemplate.KeyPortPrivate, httpLabel(databaseType), 1)
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

// httpLabel is the label of an engine's HTTP protocol, empty when it has none
func httpLabel(databaseType string) string {
	return databases.ProtocolLabel(databaseType, databases.DefaultHTTPPort(databaseType))
}

func isDatabase(service *ent.Service) bool {
	return service.Type == schema.ServiceTypeDatabase
}
