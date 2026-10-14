package networking

import (
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"net/url"
	"regexp"
	"strconv"
	"strings"

	v1 "github.com/unbindapp/unbind-operator/api/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

var htpasswdSecretGVK = schema.GroupVersionKind{Group: "", Version: "v1", Kind: "Secret"}

// hasRouteOptions reports whether the host needs routing objects of its own: the
// ingress providers carry redirects, auth and headers as per-object annotations.
func hasRouteOptions(host v1.HostSpec) bool {
	return host.Redirect != nil || host.BasicAuth != nil || len(host.ResponseHeaders) > 0
}

// routeID is the hostname and path a host routes, the hostname alone for the whole domain
func routeID(host v1.HostSpec) string {
	hostname := strings.ToLower(host.Host)
	if path := hostPath(host); path != "/" {
		return hostname + path
	}
	return hostname
}

// HostURL is the address visitors open for the host
func HostURL(host v1.HostSpec) string {
	if path := hostPath(host); path != "/" {
		return "https://" + host.Host + path
	}
	return "https://" + host.Host
}

func hostPath(host v1.HostSpec) string {
	trimmed := strings.TrimSuffix(host.Path, "/")
	if trimmed == "" {
		return "/"
	}
	return trimmed
}

// Names follow the hostname and path, not their position, so removing a host never renames another host's objects.
func hostKey(host v1.HostSpec) string {
	return shortHash(routeID(host))
}

func hostnameKey(host v1.HostSpec) string {
	return shortHash(strings.ToLower(host.Host))
}

func shortHash(value string) string {
	return fmt.Sprintf("%x", sha256.Sum256([]byte(value)))[:10]
}

func hostObjectName(svc *v1.Service, host v1.HostSpec) string {
	return svc.Name + "-host-" + hostKey(host)
}

const htpasswdSecretSuffix = "-htpasswd"

func htpasswdSecretName(objectName string) string {
	return objectName + htpasswdSecretSuffix
}

// A Service name allows 63 characters, too few for the service name and the host key together
func proxyUpstreamName(svc *v1.Service, host v1.HostSpec) string {
	return "proxy-" + shortHash(svc.Name+"/"+routeID(host))
}

var proxyUpstreamNamePattern = regexp.MustCompile(`^proxy-[0-9a-f]{10}$`)

// IsRouteObjectName reports whether a core object is one the route builders create.
// Others carry the same instance label: the service's own Service and EndpointSlices,
// or the Postgres operator's credentials.
func IsRouteObjectName(kind, name string) bool {
	switch kind {
	case "Secret":
		return strings.HasSuffix(name, htpasswdSecretSuffix)
	case "Service", "EndpointSlice":
		return proxyUpstreamNamePattern.MatchString(name)
	}
	return true
}

type urlTarget struct {
	Scheme string
	Host   string
	Port   *int32
	// Path is empty when the request path is kept
	Path string
}

// parseRedirect splits the redirect URL the API validated. A URL that does not
// parse keeps the host routed to the service instead of breaking the route.
func parseRedirect(redirect *v1.HostRedirectSpec) (urlTarget, bool) {
	if redirect == nil {
		return urlTarget{}, false
	}
	return parseURLTarget(redirect.To)
}

func parseProxy(proxy *v1.HostProxySpec) (urlTarget, bool) {
	if proxy == nil {
		return urlTarget{}, false
	}
	target, ok := parseURLTarget(proxy.To)
	target.Host = strings.ToLower(target.Host)
	return target, ok
}

func parseURLTarget(raw string) (urlTarget, bool) {
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Hostname() == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return urlTarget{}, false
	}
	target := urlTarget{Scheme: parsed.Scheme, Host: parsed.Hostname()}
	if parsed.Path != "" && parsed.Path != "/" {
		target.Path = parsed.Path
	}
	if port := parsed.Port(); port != "" {
		if n, err := strconv.ParseInt(port, 10, 32); err == nil {
			target.Port = new(int32(n))
		}
	}
	return target, true
}

// URL is the target as one string, with the request path left to the caller when
// Path is empty.
func (t urlTarget) URL() string {
	u := t.Scheme + "://" + t.Host
	if t.Port != nil {
		u += ":" + strconv.Itoa(int(*t.Port))
	}
	return u + t.Path
}

func (t urlTarget) PortOrDefault() int32 {
	if t.Port != nil {
		return *t.Port
	}
	if t.Scheme == "https" {
		return 443
	}
	return 80
}

// htpasswdSecret holds the host's user in htpasswd form under the key the
// controller reads. An empty hash gives a file nobody matches, so the host stays closed.
func htpasswdSecret(svc *v1.Service, labels map[string]string, objectName, key string, auth *v1.HostBasicAuthSpec) *unstructured.Unstructured {
	u := &unstructured.Unstructured{}
	u.SetGroupVersionKind(htpasswdSecretGVK)
	u.SetName(htpasswdSecretName(objectName))
	u.SetNamespace(svc.Namespace)
	u.SetLabels(labels)
	u.Object["type"] = "Opaque"
	line := ""
	if auth.PasswordHash != "" {
		line = auth.Username + ":" + auth.PasswordHash + "\n"
	}
	u.Object["data"] = map[string]any{key: base64.StdEncoding.EncodeToString([]byte(line))}
	return u
}
