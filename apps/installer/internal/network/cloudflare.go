package network

import (
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

type cloudflareRanges struct {
	v4 []*net.IPNet
	v6 []*net.IPNet
}

func (r *cloudflareRanges) contains(ip net.IP) bool {
	ranges := r.v4
	if ip.To4() == nil {
		ranges = r.v6
	}
	for _, n := range ranges {
		if n.Contains(ip) {
			return true
		}
	}
	return false
}

var (
	cloudflareMu     sync.Mutex
	cloudflareCached *cloudflareRanges
)

func cloudflareIPRanges(logFn func(string)) (*cloudflareRanges, error) {
	cloudflareMu.Lock()
	defer cloudflareMu.Unlock()

	if cloudflareCached != nil {
		return cloudflareCached, nil
	}

	logFn("Fetching Cloudflare IP ranges...")
	v4, err := fetchCIDRs("https://www.cloudflare.com/ips-v4")
	if err != nil {
		return nil, fmt.Errorf("failed to fetch Cloudflare IPv4 ranges: %w", err)
	}
	v6, err := fetchCIDRs("https://www.cloudflare.com/ips-v6")
	if err != nil {
		return nil, fmt.Errorf("failed to fetch Cloudflare IPv6 ranges: %w", err)
	}

	cloudflareCached = &cloudflareRanges{v4: v4, v6: v6}
	logFn(fmt.Sprintf("Cached %d IPv4 and %d IPv6 Cloudflare ranges", len(v4), len(v6)))
	return cloudflareCached, nil
}

func fetchCIDRs(url string) ([]*net.IPNet, error) {
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(url)
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

	var nets []*net.IPNet
	for _, line := range strings.Split(string(body), "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		_, n, err := net.ParseCIDR(line)
		if err != nil {
			continue
		}
		nets = append(nets, n)
	}
	return nets, nil
}
