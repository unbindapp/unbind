package networking

import (
	"encoding/base64"
	"fmt"
	"net/url"
	"strconv"

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

// hostObjectName names the objects a host gets for itself. The first host keeps the
// service's name so existing single-domain services never churn.
func hostObjectName(svc *v1.Service, index int) string {
	if index == 0 {
		return svc.Name
	}
	return fmt.Sprintf("%s-%d", svc.Name, index)
}

func htpasswdSecretName(objectName string) string {
	return objectName + "-htpasswd"
}

type redirectTarget struct {
	Scheme string
	Host   string
	Port   *int32
	// Path is empty when the request path is kept
	Path string
}

// parseRedirect splits the redirect URL the API validated. A URL that does not
// parse keeps the host routed to the service instead of breaking the route.
func parseRedirect(redirect *v1.HostRedirectSpec) (redirectTarget, bool) {
	if redirect == nil {
		return redirectTarget{}, false
	}
	parsed, err := url.Parse(redirect.To)
	if err != nil || parsed.Hostname() == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return redirectTarget{}, false
	}
	target := redirectTarget{Scheme: parsed.Scheme, Host: parsed.Hostname()}
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

// URL is the redirect target as one string, with the request path left to the
// caller when Path is empty.
func (t redirectTarget) URL() string {
	u := t.Scheme + "://" + t.Host
	if t.Port != nil {
		u += ":" + strconv.Itoa(int(*t.Port))
	}
	return u + t.Path
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
