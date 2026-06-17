package utils

import (
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/unbindapp/unbind-api/internal/common/log"
)

// DNSChecker provides methods to check DNS and Cloudflare proxy status
type DNSChecker struct {
	client         *http.Client
	cloudflareIPv4 []*net.IPNet
	cloudflareIPv6 []*net.IPNet
	lastUpdate     time.Time
	updateInterval time.Duration
	mu             sync.RWMutex
}

// NewDNSChecker creates a new DNSChecker instance with default settings
func NewDNSChecker() *DNSChecker {
	return &DNSChecker{
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
		updateInterval: 20 * time.Minute,
	}
}

// IsPointingToIP checks if a domain is pointing to a specific IP address
func (self *DNSChecker) IsPointingToIP(domain string, expectedIP string) (bool, error) {
	ips, err := net.LookupHost(domain)
	if err != nil {
		log.Errorf("failed to lookup domain %s: %v", domain, err)
		return false, nil
	}

	for _, ip := range ips {
		if ip == expectedIP {
			return true, nil
		}
	}

	return false, nil
}

// IsUsingCloudflareProxy checks if a domain is using Cloudflare proxy
func (self *DNSChecker) IsUsingCloudflareProxy(domain string) (bool, error) {
	// Ensure we have up-to-date Cloudflare IPs
	if err := self.ensureCloudflareIPsUpdated(); err != nil {
		return false, fmt.Errorf("failed to update Cloudflare IPs: %w", err)
	}

	// Lookup the IP addresses for the domain
	ips, err := net.LookupIP(domain)
	if err != nil {
		return false, fmt.Errorf("failed to lookup domain %s: %w", domain, err)
	}

	if len(ips) == 0 {
		return false, fmt.Errorf("no IP addresses found for domain %s", domain)
	}

	// Check if any IP is in Cloudflare's ranges
	self.mu.RLock()
	defer self.mu.RUnlock()

	for _, ip := range ips {
		if ip.To4() != nil {
			// IPv4
			for _, ipNet := range self.cloudflareIPv4 {
				if ipNet.Contains(ip) {
					return true, nil
				}
			}
		} else {
			// IPv6
			for _, ipNet := range self.cloudflareIPv6 {
				if ipNet.Contains(ip) {
					return true, nil
				}
			}
		}
	}

	return false, nil
}

// ensureCloudflareIPsUpdated checks if we need to update Cloudflare IPs and updates them if necessary
func (self *DNSChecker) ensureCloudflareIPsUpdated() error {
	self.mu.Lock()
	defer self.mu.Unlock()

	// Check if we need to update
	needsUpdate := len(self.cloudflareIPv4) == 0 || len(self.cloudflareIPv6) == 0 ||
		time.Since(self.lastUpdate) > self.updateInterval

	if !needsUpdate {
		return nil
	}

	// Update the IPs
	ipv4Ranges, ipv6Ranges, err := self.fetchCloudflareIPRanges()
	if err != nil {
		return err
	}

	self.cloudflareIPv4 = ipv4Ranges
	self.cloudflareIPv6 = ipv6Ranges
	self.lastUpdate = time.Now()

	return nil
}

// fetchCloudflareIPRanges fetches Cloudflare's IP ranges from their official URLs
func (self *DNSChecker) fetchCloudflareIPRanges() ([]*net.IPNet, []*net.IPNet, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Fetch IPv4 ranges
	ipv4Ranges, err := self.fetchIPRangesWithContext(ctx, "https://www.cloudflare.com/ips-v4")
	if err != nil {
		return nil, nil, fmt.Errorf("failed to fetch IPv4 ranges: %w", err)
	}

	// Fetch IPv6 ranges
	ipv6Ranges, err := self.fetchIPRangesWithContext(ctx, "https://www.cloudflare.com/ips-v6")
	if err != nil {
		return nil, nil, fmt.Errorf("failed to fetch IPv6 ranges: %w", err)
	}

	// Parse IPv4 CIDR ranges
	var parsedIPv4Ranges []*net.IPNet
	for _, cidr := range ipv4Ranges {
		if cidr == "" {
			continue
		}
		_, ipNet, err := net.ParseCIDR(cidr)
		if err != nil {
			continue // Skip invalid CIDR ranges
		}
		parsedIPv4Ranges = append(parsedIPv4Ranges, ipNet)
	}

	// Parse IPv6 CIDR ranges
	var parsedIPv6Ranges []*net.IPNet
	for _, cidr := range ipv6Ranges {
		if cidr == "" {
			continue
		}
		_, ipNet, err := net.ParseCIDR(cidr)
		if err != nil {
			continue // Skip invalid CIDR ranges
		}
		parsedIPv6Ranges = append(parsedIPv6Ranges, ipNet)
	}

	return parsedIPv4Ranges, parsedIPv6Ranges, nil
}

// fetchIPRangesWithContext fetches IP ranges from a URL with a context
func (self *DNSChecker) fetchIPRangesWithContext(ctx context.Context, url string) ([]string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := self.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("bad status code: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	// Split the body by newlines and clean up
	ranges := strings.Split(string(body), "\n")
	var cleanRanges []string

	for _, r := range ranges {
		r = strings.TrimSpace(r)
		if r != "" {
			cleanRanges = append(cleanRanges, r)
		}
	}

	return cleanRanges, nil
}
