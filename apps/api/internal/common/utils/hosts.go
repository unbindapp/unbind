package utils

import (
	"fmt"
	"regexp"
	"strings"
)

const wildcardHostPrefix = "*."

// Stands in for the "*" label when a wildcard host has to be resolved or requested
const wildcardProbeLabel = "unbind-dns-check"

var hostPattern = regexp.MustCompile(`^(?i)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$`)

func IsWildcardHost(host string) bool {
	return strings.HasPrefix(host, wildcardHostPrefix)
}

// ValidateServiceHost accepts a domain, or a wildcard with one leading "*." over at
// least two labels, so a whole TLD like "*.com" can't be claimed.
func ValidateServiceHost(host string) error {
	base := strings.TrimPrefix(host, wildcardHostPrefix)
	if len(host) > 253 || !hostPattern.MatchString(base) {
		return fmt.Errorf("invalid domain %q: use a domain like example.com, or *.example.com for every subdomain", host)
	}
	return nil
}

// WildcardCovers reports whether pattern is a wildcard that routes host to its service.
// Wildcards match subdomains at any depth, the way Gateway API routes them.
func WildcardCovers(pattern, host string) bool {
	base, isWildcard := strings.CutPrefix(strings.ToLower(pattern), wildcardHostPrefix)
	if !isWildcard {
		return false
	}
	return strings.HasSuffix(strings.TrimPrefix(strings.ToLower(host), wildcardHostPrefix), "."+base)
}

// HostsOverlap reports whether one request could match both hosts.
func HostsOverlap(a, b string) bool {
	return strings.EqualFold(a, b) || WildcardCovers(a, b) || WildcardCovers(b, a)
}

// ProbeHost returns a real hostname to resolve or request for host: a subdomain the
// wildcard covers, or the host itself.
func ProbeHost(host string) string {
	base, isWildcard := strings.CutPrefix(host, wildcardHostPrefix)
	if !isWildcard {
		return host
	}
	return wildcardProbeLabel + "." + base
}
