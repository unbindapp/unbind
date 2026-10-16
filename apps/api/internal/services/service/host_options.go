package service_service

import (
	"fmt"
	"net"
	"net/url"
	"regexp"
	"slices"
	"strconv"
	"strings"

	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"golang.org/x/net/publicsuffix"
	k8svalidation "k8s.io/apimachinery/pkg/util/validation"
)

var (
	usernamePattern     = regexp.MustCompile(`^[^:\s]{1,64}$`)
	headerNamePattern   = regexp.MustCompile(`^[A-Za-z0-9-]{1,128}$`)
	redirectStatusCodes = []int{301, 302, 307, 308}
	proxyPathPattern    = regexp.MustCompile(`^[A-Za-z0-9/._~!$&'()*+,;=:@-]*$`)
	redirectPathPattern = regexp.MustCompile(`^[A-Za-z0-9/._~!*+,:@=-]*$`)
	pathSegmentPattern  = regexp.MustCompile(`^[A-Za-z0-9._~-]+$`)
	// Headers that frame the response, which a set header would corrupt
	reservedResponseHeaders = []string{"content-length", "transfer-encoding", "connection", "host"}
)

const maxHeaderValueLength = 1024

// validateHostPath keeps the path to characters every routing controller takes as a prefix
func validateHostPath(host schema.HostSpec) error {
	path := host.RoutePath()
	if path == "/" {
		return nil
	}
	if !strings.HasPrefix(path, "/") {
		return invalid("domain %s: the path has to start with /", host.Host)
	}
	if host.IsGRPC() {
		return invalid("domain %s: a grpc domain answers on every path", host.Route())
	}
	for segment := range strings.SplitSeq(path[1:], "/") {
		if segment == "." || segment == ".." || !pathSegmentPattern.MatchString(segment) {
			return invalid("domain %s: a path may only have letters, digits and . _ ~ - between single slashes", host.Route())
		}
	}
	return nil
}

func duplicateRoute(hosts []schema.HostSpec) (string, bool) {
	seen := make(map[string]struct{}, len(hosts))
	for _, host := range hosts {
		key := host.RouteKey()
		if _, ok := seen[key]; ok {
			return host.Route(), true
		}
		seen[key] = struct{}{}
	}
	return "", false
}

// validateHostOptions checks a domain's redirect, proxy, basic auth and headers. The values
// land in Envoy filters and nginx config verbatim, so the character set stays narrow.
func validateHostOptions(host schema.HostSpec) error {
	if host.Redirect != nil {
		if host.BasicAuth != nil {
			return invalid("domain %s: a redirect cannot have basic auth, the service never answers", host.Route())
		}
		if host.Proxy != nil {
			return invalid("domain %s: a domain can redirect or proxy, not both", host.Route())
		}
		if err := validateRedirect(host); err != nil {
			return err
		}
	}
	if host.Proxy != nil {
		if err := validateProxy(host); err != nil {
			return err
		}
	}
	if host.BasicAuth != nil && !usernamePattern.MatchString(host.BasicAuth.Username) {
		return invalid("domain %s: basic auth needs a username without spaces or colons", host.Route())
	}
	seen := map[string]struct{}{}
	for _, header := range host.ResponseHeaders {
		if !headerNamePattern.MatchString(header.Name) {
			return invalid("domain %s: header name %q may only have letters, digits and dashes", host.Route(), header.Name)
		}
		name := strings.ToLower(header.Name)
		if slices.Contains(reservedResponseHeaders, name) {
			return invalid("domain %s: header %s cannot be set", host.Route(), header.Name)
		}
		if _, ok := seen[name]; ok {
			return invalid("domain %s: header %s is listed twice", host.Route(), header.Name)
		}
		seen[name] = struct{}{}
		if err := validateHeaderValue(header.Value); err != nil {
			return invalid("domain %s: header %s %s", host.Route(), header.Name, err)
		}
	}
	return nil
}

func validateRedirect(host schema.HostSpec) error {
	redirect := host.Redirect
	target, err := url.Parse(redirect.To)
	if err != nil || (target.Scheme != "http" && target.Scheme != "https") || target.Hostname() == "" {
		return invalid("domain %s: redirect to a URL with http or https, like https://example.com", host.Route())
	}
	if target.RawQuery != "" || target.Fragment != "" || target.User != nil {
		return invalid("domain %s: a redirect URL cannot have a query, fragment or credentials", host.Route())
	}
	if !redirectPathPattern.MatchString(target.Path) {
		return invalid("domain %s: the redirect path can only have letters, digits and / . _ ~ ! * + , : @ = -", host.Route())
	}
	if strings.EqualFold(target.Hostname(), host.Host) && target.Path == "" {
		return invalid("domain %s: a redirect to itself would loop", host.Route())
	}
	if redirect.StatusCode != 0 && !slices.Contains(redirectStatusCodes, redirect.StatusCode) {
		return invalid("domain %s: redirect status must be 301, 302, 307 or 308", host.Route())
	}
	return nil
}

func validateProxy(host schema.HostSpec) error {
	if host.IsGRPC() {
		return invalid("domain %s: a proxy serves http, not grpc", host.Route())
	}
	target, err := url.Parse(host.Proxy.To)
	if err != nil || (target.Scheme != "http" && target.Scheme != "https") || target.Hostname() == "" {
		return invalid("domain %s: proxy to a URL with http or https, like https://example.com", host.Route())
	}
	if target.RawQuery != "" || target.Fragment != "" || target.User != nil {
		return invalid("domain %s: a proxy URL cannot have a query, fragment or credentials", host.Route())
	}
	if port := target.Port(); port != "" {
		if n, err := strconv.Atoi(port); err != nil || n < 1 || n > 65535 {
			return invalid("domain %s: the proxy port must be between 1 and 65535", host.Route())
		}
	}
	if !isPublicHostname(target.Hostname()) {
		return invalid("domain %s: proxy to a public hostname, not an IP address or a name inside the cluster", host.Route())
	}
	if strings.EqualFold(target.Hostname(), host.Host) {
		return invalid("domain %s: a proxy to itself would loop", host.Route())
	}
	if !proxyPathPattern.MatchString(target.Path) {
		return invalid("domain %s: the proxy path can only have characters a URL path allows unescaped", host.Route())
	}
	return nil
}

// The proxy resolves the target from inside the cluster, where a name without a known
// public suffix can reach a cluster service through the DNS search domains
func isPublicHostname(hostname string) bool {
	name := strings.ToLower(hostname)
	if net.ParseIP(name) != nil || len(k8svalidation.IsDNS1123Subdomain(name)) > 0 {
		return false
	}
	suffix, icann := publicsuffix.PublicSuffix(name)
	return icann || strings.Contains(suffix, ".")
}

func validateHeaderValue(value string) error {
	if value == "" {
		return fmt.Errorf("needs a value")
	}
	if len(value) > maxHeaderValueLength {
		return fmt.Errorf("value is longer than %d characters", maxHeaderValueLength)
	}
	for _, r := range value {
		if r < 0x20 || r > 0x7e || r == '"' || r == '\\' || r == '$' {
			return fmt.Errorf("value may only have printable characters, without quotes, backslashes or dollar signs")
		}
	}
	return nil
}

func invalid(format string, args ...any) error {
	return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, fmt.Sprintf(format, args...))
}

// validateClientIPHeader accepts a header name, or an empty string that goes back to automatic
func validateClientIPHeader(header *string) error {
	if header == nil || *header == "" || headerNamePattern.MatchString(*header) {
		return nil
	}
	return invalid("client IP header may only have letters, digits and dashes, like CF-Connecting-IP")
}

// prepareBasicAuth turns typed passwords into hashes and keeps the saved hash of a
// domain whose password was left out. A domain that never had one needs a password.
func prepareBasicAuth(existing []schema.HostSpec, inputs ...[]schema.HostSpec) error {
	hashes := map[string]string{}
	for _, host := range existing {
		if host.BasicAuth != nil {
			hashes[host.RouteKey()] = host.BasicAuth.PasswordHash
		}
	}
	for _, hosts := range inputs {
		for i := range hosts {
			auth := hosts[i].BasicAuth
			if auth == nil {
				continue
			}
			if auth.Password != "" {
				hosts[i].BasicAuth = &schema.HostBasicAuth{Username: auth.Username, PasswordHash: schema.HashBasicAuthPassword(auth.Password)}
				continue
			}
			hash, ok := hashes[hosts[i].PrevRouteKey()]
			if !ok {
				return invalid("domain %s: enter a password for basic auth", hosts[i].Route())
			}
			hosts[i].BasicAuth = &schema.HostBasicAuth{Username: auth.Username, PasswordHash: hash}
		}
	}
	return nil
}
