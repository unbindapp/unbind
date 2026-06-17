package network

import (
	"bytes"
	"fmt"
	"io"
	"net"
	"net/http"
	"os/exec"
	"regexp"
	"strings"
	"time"
)

// IPInfo stores network addressing details
type IPInfo struct {
	InternalIP string
	ExternalIP string
	CIDR       string
}

// DetectIPs finds network addressing info
func DetectIPs(logFn func(string)) (*IPInfo, error) {
	ipInfo := &IPInfo{}

	// Detect internal IP
	logFn("Detecting internal IP address...")
	internalIP, err := detectInternalIP()
	if err != nil {
		logFn(fmt.Sprintf("Warning: Could not auto-detect internal IP: %v", err))
	} else {
		ipInfo.InternalIP = internalIP
		logFn(fmt.Sprintf("Detected internal IP: %s", internalIP))
	}

	// Detect external IP
	logFn("Detecting external IP address...")
	externalIP, err := detectExternalIP()
	if err != nil {
		logFn(fmt.Sprintf("Error: Could not auto-detect external IP: %v", err))
		return nil, err
	} else {
		ipInfo.ExternalIP = externalIP
		logFn(fmt.Sprintf("Detected external IP: %s", externalIP))
	}

	// Detect network CIDR
	logFn("Detecting network CIDR...")
	networkCIDR, err := detectNetworkCIDR()
	if err != nil {
		logFn(fmt.Sprintf("Error: Could not auto-detect network CIDR: %v", err))
		return nil, err
	} else {
		ipInfo.CIDR = networkCIDR
		logFn(fmt.Sprintf("Detected network CIDR: %s", networkCIDR))
	}

	return ipInfo, nil
}

// detectInternalIP tries to find the local IP
func detectInternalIP() (string, error) {
	// First try: Use Go's net package
	conn, err := net.Dial("udp", "8.8.8.8:80")
	if err == nil {
		defer conn.Close()
		localAddr := conn.LocalAddr().(*net.UDPAddr)
		return localAddr.IP.String(), nil
	}

	// Second try: Run ip route command
	cmd := exec.Command("ip", "route", "get", "1")
	output, err := cmd.Output()
	if err == nil {
		re := regexp.MustCompile(`src\s+(\d+\.\d+\.\d+\.\d+)`)
		matches := re.FindSubmatch(output)
		if len(matches) > 1 {
			return string(matches[1]), nil
		}
	}

	// Third try: Get all network interfaces
	interfaces, err := net.Interfaces()
	if err != nil {
		return "", err
	}

	for _, iface := range interfaces {
		// Skip loopback and not up interfaces
		if iface.Flags&net.FlagLoopback != 0 || iface.Flags&net.FlagUp == 0 {
			continue
		}

		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}

		for _, addr := range addrs {
			ipNet, ok := addr.(*net.IPNet)
			if !ok {
				continue
			}

			v4 := ipNet.IP.To4()
			if v4 == nil || v4[0] == 127 { // Skip loopback addresses
				continue
			}

			return v4.String(), nil
		}
	}

	return "", fmt.Errorf("could not detect internal IP address")
}

// detectExternalIP finds the public-facing IP
func detectExternalIP() (string, error) {
	// List of services to try
	services := []string{
		"https://ifconfig.me",
		"https://api.ipify.org",
		"https://ipinfo.io/ip",
		"https://checkip.amazonaws.com",
	}

	ipRegex := regexp.MustCompile(`^(\d{1,3}\.){3}\d{1,3}$`)
	client := &http.Client{Timeout: 5 * time.Second}

	for _, service := range services {
		resp, err := client.Get(service)
		if err != nil {
			continue
		}

		defer resp.Body.Close()
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			continue
		}

		ip := strings.TrimSpace(string(body))
		if ipRegex.MatchString(ip) {
			return ip, nil
		}
	}

	return "", fmt.Errorf("could not detect external IP address")
}

// getPrimaryInterface finds the main network interface
// Tries default route first, falls back to first active interface
func getPrimaryInterface() (*net.Interface, error) {
	// Get all network interfaces
	interfaces, err := net.Interfaces()
	if err != nil {
		return nil, fmt.Errorf("failed to get network interfaces: %w", err)
	}

	// First try: find interface with default route
	// The approach is to find interfaces that have gateway routes
	for _, iface := range interfaces {
		// Skip interfaces that are down
		if iface.Flags&net.FlagUp == 0 {
			continue
		}

		// Skip loopback interfaces
		if iface.Flags&net.FlagLoopback != 0 {
			continue
		}

		// Get interface addresses
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}

		// Check if this interface has IPv4 addresses
		for _, addr := range addrs {
			if ipnet, ok := addr.(*net.IPNet); ok && !ipnet.IP.IsLoopback() && ipnet.IP.To4() != nil {
				// This is a likely candidate for the primary interface
				return &iface, nil
			}
		}
	}

	// Second try: just get the first non-loopback interface with an IPv4 address
	for _, iface := range interfaces {
		if iface.Flags&net.FlagUp != 0 && iface.Flags&net.FlagLoopback == 0 {
			addrs, err := iface.Addrs()
			if err != nil {
				continue
			}

			for _, addr := range addrs {
				if ipnet, ok := addr.(*net.IPNet); ok && ipnet.IP.To4() != nil {
					return &iface, nil
				}
			}
		}
	}

	return nil, fmt.Errorf("no suitable network interface found")
}

// detectNetworkCIDR gets the network CIDR
func detectNetworkCIDR() (string, error) {
	iface, err := getPrimaryInterface()
	if err != nil {
		return "", fmt.Errorf("failed to get primary network interface: %w", err)
	}

	addrs, err := iface.Addrs()
	if err != nil {
		return "", fmt.Errorf("failed to get addresses for interface %s: %w", iface.Name, err)
	}

	// Find the first IPv4 address
	for _, addr := range addrs {
		if ipnet, ok := addr.(*net.IPNet); ok && ipnet.IP.To4() != nil {
			return ipnet.String(), nil
		}
	}

	return "", fmt.Errorf("no IPv4 address found for interface %s", iface.Name)
}

// ValidateIP - simple IP format check
func ValidateIP(ip string) bool {
	return net.ParseIP(ip) != nil
}

// CheckCloudflareProxy detects Cloudflare proxying
func CheckCloudflareProxy(domain string, logFn func(string)) bool {
	logFn(fmt.Sprintf("Checking if %s is using Cloudflare...", domain))

	// Use Go's built-in DNS resolution
	ips, err := net.LookupIP(domain)
	if err != nil {
		logFn(fmt.Sprintf("Error looking up IP addresses: %v", err))
		return false
	}

	if len(ips) == 0 {
		logFn(fmt.Sprintf("No IP addresses found for %s", domain))
		return false
	}

	// Fetch Cloudflare's IP ranges
	ipv4Ranges, ipv6Ranges, err := fetchCloudflareIPRanges(logFn)
	if err != nil {
		logFn(fmt.Sprintf("Error fetching Cloudflare IP ranges: %v", err))
		return false
	}

	// Check if any IP is in Cloudflare's ranges
	for _, ip := range ips {
		ipStr := ip.String()
		logFn(fmt.Sprintf("Domain resolves to IP: %s", ipStr))

		// Check IPv4 or IPv6 based on IP type
		if ip.To4() != nil {
			// IPv4
			for _, ipNet := range ipv4Ranges {
				if ipNet.Contains(ip) {
					logFn(fmt.Sprintf("IP %s is in Cloudflare IPv4 range ✓", ipStr))
					return true
				}
			}
		} else {
			// IPv6
			for _, ipNet := range ipv6Ranges {
				if ipNet.Contains(ip) {
					logFn(fmt.Sprintf("IP %s is in Cloudflare IPv6 range ✓", ipStr))
					return true
				}
			}
		}
	}

	logFn("Domain is not using Cloudflare proxying")
	return false
}

// fetchCloudflareIPRanges gets CF IP ranges for checking
func fetchCloudflareIPRanges(logFn func(string)) ([]*net.IPNet, []*net.IPNet, error) {
	ipv4URL := "https://www.cloudflare.com/ips-v4"
	ipv6URL := "https://www.cloudflare.com/ips-v6"

	logFn("Fetching Cloudflare IPv4 ranges...")
	ipv4Ranges, err := fetchIPRanges(ipv4URL)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to fetch IPv4 ranges: %w", err)
	}

	logFn("Fetching Cloudflare IPv6 ranges...")
	ipv6Ranges, err := fetchIPRanges(ipv6URL)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to fetch IPv6 ranges: %w", err)
	}

	// Parse CIDR ranges
	var parsedIPv4Ranges []*net.IPNet
	for _, cidr := range ipv4Ranges {
		_, ipNet, err := net.ParseCIDR(cidr)
		if err != nil {
			logFn(fmt.Sprintf("Error parsing CIDR %s: %v", cidr, err))
			continue
		}
		parsedIPv4Ranges = append(parsedIPv4Ranges, ipNet)
	}

	var parsedIPv6Ranges []*net.IPNet
	for _, cidr := range ipv6Ranges {
		_, ipNet, err := net.ParseCIDR(cidr)
		if err != nil {
			logFn(fmt.Sprintf("Error parsing CIDR %s: %v", cidr, err))
			continue
		}
		parsedIPv6Ranges = append(parsedIPv6Ranges, ipNet)
	}

	logFn(fmt.Sprintf("Fetched %d IPv4 ranges and %d IPv6 ranges",
		len(parsedIPv4Ranges), len(parsedIPv6Ranges)))

	return parsedIPv4Ranges, parsedIPv6Ranges, nil
}

// fetchIPRanges downloads IP ranges from URL
func fetchIPRanges(url string) ([]string, error) {
	// Create HTTP client with reasonable timeout
	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	// Make the request
	resp, err := client.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	// Check if request was successful
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("bad status code: %d", resp.StatusCode)
	}

	// Read the response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	// Split by newlines and clean up
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

// ValidateDNS verifies DNS record points to expected IP
func ValidateDNS(domain string, expectedIP string, logFn func(string)) bool {
	logFn(fmt.Sprintf("Validating DNS for %s...", domain))

	// Use Go's built-in DNS lookup
	ips, err := net.LookupHost(domain)
	if err != nil {
		logFn(fmt.Sprintf("DNS lookup failed: %v", err))
		return false
	}

	if len(ips) == 0 {
		logFn(fmt.Sprintf("No IP addresses found for %s", domain))
		return false
	}

	// Log all found IPs
	logFn(fmt.Sprintf("Domain %s resolves to: %s", domain, strings.Join(ips, ", ")))

	// Check if any IP matches the expected IP
	for _, ip := range ips {
		if ip == expectedIP {
			logFn(fmt.Sprintf("Domain %s correctly points to %s ✓", domain, expectedIP))
			return true
		}
	}

	logFn(fmt.Sprintf("Domain does not point to expected IP %s", expectedIP))
	return false
}

// RunNetworkCommand runs a command and gets output
func RunNetworkCommand(command string, args ...string) (string, error) {
	cmd := exec.Command(command, args...)
	var out bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &out
	err := cmd.Run()
	return out.String(), err
}
