package utils

import (
	"fmt"
	"net/url"
	"path"
	"regexp"
	"strings"
)

func JoinURLPaths(baseURL string, paths ...string) (string, error) {
	u, err := url.Parse(baseURL)
	if err != nil {
		return "", err
	}

	u.Path = path.Join(append([]string{u.Path}, paths...)...)
	return u.String(), nil
}

// ValidateAndExtractDomain takes a URL string and:
// 1. Validates if it's a proper URL (must start with http:// or https://)
// 2. Extracts the domain name
// 3. Converts special characters to hyphens
// Returns the transformed domain and an error if invalid
func ValidateAndExtractDomain(urlStr string) (string, error) {
	// Parse the URL
	parsedURL, err := url.Parse(urlStr)
	if err != nil {
		return "", err
	}

	// Check if scheme is http or https
	if parsedURL.Scheme != "http" && parsedURL.Scheme != "https" {
		return "", fmt.Errorf("invalid URL scheme: %s", parsedURL.Scheme)
	}

	// Get hostname and remove port if present
	hostname := parsedURL.Hostname()
	if hostname == "" {
		return "", fmt.Errorf("missing hostname in URL")
	}

	// Handle any potential URL encoding in the hostname
	hostname, _ = url.QueryUnescape(hostname)

	// Convert special characters to hyphens and remove trailing/leading hyphens
	transformed := transformDomain(hostname)

	return transformed, nil
}

// transformDomain converts special characters to hyphens
func transformDomain(domain string) string {
	// Replace dots and other special characters with hyphens
	reg := regexp.MustCompile(`[^a-zA-Z0-9]+`)
	transformed := reg.ReplaceAllString(domain, "-")

	// Remove leading and trailing hyphens
	transformed = strings.Trim(transformed, "-")

	return transformed
}

// Generate a default subdomain
func GenerateSubdomain(name, externalURL string) (string, error) {
	// Extract the domain from externalURL (without protocol)
	u, err := url.Parse(externalURL)
	if err != nil {
		return "", fmt.Errorf("invalid external URL: %w", err)
	}

	domain := u.Hostname()

	// Sanitize name
	sanitizedDisplay := sanitizeForSubdomain(name)

	// Check if we have valid components
	if sanitizedDisplay == "" {
		return "", fmt.Errorf("could not generate subdomain: name sanitized to empty string")
	}

	// Create the subdomain pattern
	subdomain := sanitizedDisplay

	// Form the complete domain
	fullDomain := fmt.Sprintf("%s.%s", subdomain, domain)

	return fullDomain, nil
}

// sanitizeForSubdomain converts a string to a valid subdomain part
// by replacing spaces with hyphens, converting to lowercase and removing invalid characters
func sanitizeForSubdomain(s string) string {
	// Replace spaces and underscores with hyphens
	s = strings.ReplaceAll(s, " ", "-")
	s = strings.ReplaceAll(s, "_", "-")

	// Convert to lowercase
	s = strings.ToLower(s)

	// Keep only alphanumeric characters and hyphens
	reg := regexp.MustCompile("[^a-z0-9-]")
	s = reg.ReplaceAllString(s, "")

	// Replace multiple consecutive hyphens with a single one
	reg = regexp.MustCompile("-+")
	s = reg.ReplaceAllString(s, "-")

	// Remove leading and trailing hyphens
	s = strings.Trim(s, "-")

	return s
}

// CleanAndValidateHost takes a host string and returns a cleaned version with protocol removed
// and ensures it's a valid domain. Returns an error if the host is invalid.
func CleanAndValidateHost(host string) (string, error) {
	// Remove protocol if present
	host = strings.TrimPrefix(host, "http://")
	host = strings.TrimPrefix(host, "https://")
	host = strings.TrimSuffix(host, "/")

	// Basic domain validation
	if !strings.Contains(host, ".") {
		return "", fmt.Errorf("invalid domain: must contain at least one dot")
	}

	// Check for invalid characters
	if strings.ContainsAny(host, "!@#$%^&*()_+{}|:\"<>?[]\\;',") {
		return "", fmt.Errorf("invalid domain: contains invalid characters")
	}

	return host, nil
}
