package service_service

import (
	"fmt"
	"net/url"
	"regexp"
	"slices"
	"strings"

	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
)

var (
	usernamePattern     = regexp.MustCompile(`^[^:\s]{1,64}$`)
	headerNamePattern   = regexp.MustCompile(`^[A-Za-z0-9-]{1,128}$`)
	redirectStatusCodes = []int{301, 302, 307, 308}
	// Headers that frame the response, which a set header would corrupt
	reservedResponseHeaders = []string{"content-length", "transfer-encoding", "connection", "host"}
)

const maxHeaderValueLength = 1024

// validateHostOptions checks a domain's redirect, basic auth and headers. The values
// land in Envoy filters and nginx config verbatim, so the character set stays narrow.
func validateHostOptions(host schema.HostSpec) error {
	if host.Redirect != nil {
		if host.BasicAuth != nil {
			return invalid("domain %s: a redirect cannot have basic auth, the service never answers", host.Host)
		}
		if err := validateRedirect(host); err != nil {
			return err
		}
	}
	if host.BasicAuth != nil && !usernamePattern.MatchString(host.BasicAuth.Username) {
		return invalid("domain %s: basic auth needs a username without spaces or colons", host.Host)
	}
	seen := map[string]struct{}{}
	for _, header := range host.ResponseHeaders {
		if !headerNamePattern.MatchString(header.Name) {
			return invalid("domain %s: header name %q may only have letters, digits and dashes", host.Host, header.Name)
		}
		name := strings.ToLower(header.Name)
		if slices.Contains(reservedResponseHeaders, name) {
			return invalid("domain %s: header %s cannot be set", host.Host, header.Name)
		}
		if _, ok := seen[name]; ok {
			return invalid("domain %s: header %s is listed twice", host.Host, header.Name)
		}
		seen[name] = struct{}{}
		if err := validateHeaderValue(header.Value); err != nil {
			return invalid("domain %s: header %s %s", host.Host, header.Name, err)
		}
	}
	return nil
}

func validateRedirect(host schema.HostSpec) error {
	redirect := host.Redirect
	target, err := url.Parse(redirect.To)
	if err != nil || (target.Scheme != "http" && target.Scheme != "https") || target.Hostname() == "" {
		return invalid("domain %s: redirect to a URL with http or https, like https://example.com", host.Host)
	}
	if target.RawQuery != "" || target.Fragment != "" || target.User != nil {
		return invalid("domain %s: a redirect URL cannot have a query, fragment or credentials", host.Host)
	}
	if strings.EqualFold(target.Hostname(), host.Host) && target.Path == "" {
		return invalid("domain %s: a redirect to itself would loop", host.Host)
	}
	if redirect.StatusCode != 0 && !slices.Contains(redirectStatusCodes, redirect.StatusCode) {
		return invalid("domain %s: redirect status must be 301, 302, 307 or 308", host.Host)
	}
	return nil
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
			hashes[strings.ToLower(host.Host)] = host.BasicAuth.PasswordHash
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
			key := strings.ToLower(hosts[i].Host)
			if hosts[i].PrevHost != nil {
				key = strings.ToLower(*hosts[i].PrevHost)
			}
			hash, ok := hashes[key]
			if !ok {
				return invalid("domain %s: enter a password for basic auth", hosts[i].Host)
			}
			hosts[i].BasicAuth = &schema.HostBasicAuth{Username: auth.Username, PasswordHash: hash}
		}
	}
	return nil
}
