package networking

import (
	v1 "github.com/unbindapp/unbind-operator/api/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

var certificateGVK = schema.GroupVersionKind{Group: "cert-manager.io", Version: "v1", Kind: "Certificate"}

// Unstructured to avoid depending on the cert-manager module.
func newCertificate(svc *v1.Service, labels map[string]string, name, issuer string, hosts []v1.HostSpec) *unstructured.Unstructured {
	dnsNames := make([]any, len(hosts))
	for i, h := range hosts {
		dnsNames[i] = h.Host
	}
	u := &unstructured.Unstructured{}
	u.SetGroupVersionKind(certificateGVK)
	u.SetName(name)
	u.SetNamespace(svc.Namespace)
	u.SetLabels(labels)
	u.Object["spec"] = map[string]any{
		"secretName": name,
		"dnsNames":   dnsNames,
		"issuerRef": map[string]any{
			"name":  issuer,
			"kind":  "ClusterIssuer",
			"group": "cert-manager.io",
		},
	}
	return u
}

// wildcardCertificate covers a service's wildcard hosts with a self-signed certificate.
// Let's Encrypt only issues wildcards over DNS-01, so these hosts expect a proxy in
// front that terminates TLS for visitors. Kept apart from the ACME certificate so a
// wildcard never blocks the other hosts.
func wildcardCertificate(cfg Config, svc *v1.Service, labels map[string]string, hosts []v1.HostSpec) *unstructured.Unstructured {
	u := newCertificate(svc, labels, wildcardTLSSecretName(svc), cfg.SelfSignedIssuer, hosts)
	// A self-signed certificate takes its issuer name from its own subject, which can't be empty
	_ = unstructured.SetNestedStringSlice(u.Object, []string{"Unbind"}, "spec", "subject", "organizations")
	return u
}
