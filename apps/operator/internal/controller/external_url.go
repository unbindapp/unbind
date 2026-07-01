package controller

import (
	"context"
	"net"
	"net/url"
	"sort"
	"strconv"

	v1 "github.com/unbindapp/unbind-operator/api/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/types"
)

const externalURLKey = "DATABASE_EXTERNAL_URL"

// reconcileExternalDatabaseURL keeps DATABASE_EXTERNAL_URL in the credential secret in
// sync with the database's public exposure: present (node IP / gateway host : nodePort)
// when public, absent when private.
func (r *ServiceReconciler) reconcileExternalDatabaseURL(ctx context.Context, service *v1.Service) error {
	if service.Spec.KubernetesSecret == "" {
		return nil
	}

	secret := &corev1.Secret{}
	if err := r.Get(ctx, types.NamespacedName{Namespace: service.Namespace, Name: service.Spec.KubernetesSecret}, secret); err != nil {
		if errors.IsNotFound(err) {
			return nil
		}
		return err
	}

	want, ok := r.desiredExternalDatabaseURL(ctx, service, secret)
	current := string(secret.Data[externalURLKey])

	switch {
	case ok && want != current:
		if secret.Data == nil {
			secret.Data = map[string][]byte{}
		}
		secret.Data[externalURLKey] = []byte(want)
	case !ok && current != "":
		delete(secret.Data, externalURLKey)
	default:
		return nil
	}

	return r.Update(ctx, secret)
}

func (r *ServiceReconciler) desiredExternalDatabaseURL(ctx context.Context, service *v1.Service, secret *corev1.Secret) (string, bool) {
	if !service.Spec.Config.Public {
		return "", false
	}

	var exposedPort, nodePort int32
	for _, port := range service.Spec.Config.Ports {
		if port.NodePort != nil {
			exposedPort = port.Port
			nodePort = *port.NodePort
			break
		}
	}
	if nodePort == 0 {
		return "", false
	}

	host := r.externalDatabaseHost(ctx, service)
	if host == "" {
		return "", false
	}

	return externalURLFromInternal(secret.Data, exposedPort, host, nodePort)
}

// externalDatabaseHost is the gateway host when one is routable, otherwise any node's IP.
func (r *ServiceReconciler) externalDatabaseHost(ctx context.Context, service *v1.Service) string {
	if len(service.Spec.Config.Hosts) > 0 && service.Spec.Config.Hosts[0].Host != "" {
		return service.Spec.Config.Hosts[0].Host
	}
	return r.anyNodeIP(ctx)
}

// anyNodeIP returns a deterministic node address (external preferred) so the URL is stable.
func (r *ServiceReconciler) anyNodeIP(ctx context.Context) string {
	nodes := &corev1.NodeList{}
	if err := r.List(ctx, nodes); err != nil {
		return ""
	}
	sort.Slice(nodes.Items, func(i, j int) bool { return nodes.Items[i].Name < nodes.Items[j].Name })

	var internal string
	for _, node := range nodes.Items {
		for _, addr := range node.Status.Addresses {
			if addr.Type == corev1.NodeExternalIP && addr.Address != "" {
				return addr.Address
			}
			if addr.Type == corev1.NodeInternalIP && internal == "" {
				internal = addr.Address
			}
		}
	}
	return internal
}

// externalURLFromInternal rebuilds the internal connection string (the one whose port
// matches the externally exposed container port) against the external host:nodePort.
func externalURLFromInternal(data map[string][]byte, exposedPort int32, host string, nodePort int32) (string, bool) {
	for _, key := range []string{"DATABASE_URL", "DATABASE_HTTP_URL"} {
		raw, ok := data[key]
		if !ok {
			continue
		}
		u, err := url.Parse(string(raw))
		if err != nil || u.Host == "" {
			continue
		}
		if u.Port() != strconv.Itoa(int(exposedPort)) {
			continue
		}
		u.Host = net.JoinHostPort(host, strconv.Itoa(int(nodePort)))
		return u.String(), true
	}
	return "", false
}
