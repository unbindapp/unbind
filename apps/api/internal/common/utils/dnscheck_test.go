package utils

import (
	"context"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"
)

// mockDNSChecker wraps DNSChecker to allow mocking DNS lookups
type mockDNSChecker struct {
	*DNSChecker
	mockLookupHost func(host string) ([]string, error)
	mockLookupIP   func(host string) ([]net.IP, error)
}

func (m *mockDNSChecker) IsPointingToIP(domain string, expectedIP string) (bool, error) {
	ips, err := m.mockLookupHost(domain)
	if err != nil {
		return false, err
	}

	for _, ip := range ips {
		if ip == expectedIP {
			return true, nil
		}
	}

	return false, nil
}

func (m *mockDNSChecker) IsUsingCloudflareProxy(domain string) (bool, error) {
	// Ensure we have up-to-date Cloudflare IPs
	if err := m.ensureCloudflareIPsUpdated(); err != nil {
		return false, err
	}

	// Lookup the IP addresses for the domain
	ips, err := m.mockLookupIP(domain)
	if err != nil {
		return false, err
	}

	if len(ips) == 0 {
		return false, nil
	}

	// Check if any IP is in Cloudflare's ranges
	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, ip := range ips {
		if ip.To4() != nil {
			// IPv4
			for _, ipNet := range m.cloudflareIPv4 {
				if ipNet.Contains(ip) {
					return true, nil
				}
			}
		} else {
			// IPv6
			for _, ipNet := range m.cloudflareIPv6 {
				if ipNet.Contains(ip) {
					return true, nil
				}
			}
		}
	}

	return false, nil
}

type DNSCheckerTestSuite struct {
	suite.Suite
	checker *mockDNSChecker
	server  *httptest.Server
}

func (suite *DNSCheckerTestSuite) SetupSuite() {
	baseChecker := NewDNSChecker()
	suite.checker = &mockDNSChecker{
		DNSChecker: baseChecker,
	}
}

func (suite *DNSCheckerTestSuite) TearDownSuite() {
	if suite.server != nil {
		suite.server.Close()
	}
}

func (suite *DNSCheckerTestSuite) TestNewDNSChecker() {
	checker := NewDNSChecker()
	assert.NotNil(suite.T(), checker)
	assert.NotNil(suite.T(), checker.client)
	assert.Equal(suite.T(), 10*time.Second, checker.client.Timeout)
	assert.Equal(suite.T(), 20*time.Minute, checker.updateInterval)
}

func (suite *DNSCheckerTestSuite) TestIsPointingToIP() {
	// Test cases
	tests := []struct {
		name       string
		domain     string
		expectedIP string
		mockIPs    []string
		want       bool
		wantErr    bool
	}{
		{
			name:       "Domain points to expected IP",
			domain:     "example.com",
			expectedIP: "192.168.1.1",
			mockIPs:    []string{"192.168.1.1"},
			want:       true,
			wantErr:    false,
		},
		{
			name:       "Domain points to different IP",
			domain:     "example.com",
			expectedIP: "192.168.1.1",
			mockIPs:    []string{"192.168.1.2"},
			want:       false,
			wantErr:    false,
		},
		{
			name:       "Domain has multiple IPs including expected",
			domain:     "example.com",
			expectedIP: "192.168.1.1",
			mockIPs:    []string{"192.168.1.1", "192.168.1.2"},
			want:       true,
			wantErr:    false,
		},
	}

	for _, tt := range tests {
		suite.T().Run(tt.name, func(t *testing.T) {
			// Set up mock lookup function
			suite.checker.mockLookupHost = func(host string) ([]string, error) {
				return tt.mockIPs, nil
			}

			got, err := suite.checker.IsPointingToIP(tt.domain, tt.expectedIP)
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
			assert.Equal(t, tt.want, got)
		})
	}
}

func (suite *DNSCheckerTestSuite) TestIsUsingCloudflareProxy() {
	// Test cases
	tests := []struct {
		name           string
		domain         string
		mockIPs        []net.IP
		cloudflareIPs  []string
		want           bool
		wantErr        bool
		setupServer    bool
		serverResponse string
	}{
		{
			name:   "Domain using Cloudflare IPv4",
			domain: "example.com",
			mockIPs: []net.IP{
				net.ParseIP("103.21.244.0"), // Example Cloudflare IP
			},
			cloudflareIPs: []string{
				"103.21.244.0/22",
			},
			want:        true,
			wantErr:     false,
			setupServer: true,
			serverResponse: `103.21.244.0/22
103.21.248.0/22`,
		},
		{
			name:   "Domain using Cloudflare IPv6",
			domain: "example.com",
			mockIPs: []net.IP{
				net.ParseIP("2400:cb00::"), // Example Cloudflare IPv6
			},
			cloudflareIPs: []string{
				"2400:cb00::/32",
			},
			want:        true,
			wantErr:     false,
			setupServer: true,
			serverResponse: `2400:cb00::/32
2405:8100::/32`,
		},
		{
			name:   "Domain not using Cloudflare",
			domain: "example.com",
			mockIPs: []net.IP{
				net.ParseIP("8.8.8.8"), // Google DNS IP
			},
			cloudflareIPs: []string{
				"103.21.244.0/22",
			},
			want:        false,
			wantErr:     false,
			setupServer: true,
			serverResponse: `103.21.244.0/22
103.21.248.0/22`,
		},
	}

	for _, tt := range tests {
		suite.T().Run(tt.name, func(t *testing.T) {
			if tt.setupServer {
				// Setup mock server for Cloudflare IP ranges
				suite.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					w.Write([]byte(tt.serverResponse))
				}))
				suite.checker.client = &http.Client{
					Timeout: 10 * time.Second,
				}
			}

			// Set up mock lookup function
			suite.checker.mockLookupIP = func(host string) ([]net.IP, error) {
				return tt.mockIPs, nil
			}

			got, err := suite.checker.IsUsingCloudflareProxy(tt.domain)
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
			assert.Equal(t, tt.want, got)
		})
	}
}

func (suite *DNSCheckerTestSuite) TestFetchCloudflareIPRanges() {
	// Setup mock server
	suite.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/ips-v4" {
			w.Write([]byte("103.21.244.0/22\n103.21.248.0/22"))
		} else if r.URL.Path == "/ips-v6" {
			w.Write([]byte("2400:cb00::/32\n2405:8100::/32"))
		}
	}))

	// Update checker to use mock server
	suite.checker.client = &http.Client{
		Timeout: 10 * time.Second,
	}

	ipv4Ranges, ipv6Ranges, err := suite.checker.fetchCloudflareIPRanges()
	assert.NoError(suite.T(), err)
	assert.NotEmpty(suite.T(), ipv4Ranges)
	assert.NotEmpty(suite.T(), ipv6Ranges)

	// Verify IPv4 ranges
	for _, ipNet := range ipv4Ranges {
		assert.True(suite.T(), ipNet.IP.To4() != nil)
	}

	// Verify IPv6 ranges
	for _, ipNet := range ipv6Ranges {
		assert.True(suite.T(), ipNet.IP.To4() == nil)
	}
}

func (suite *DNSCheckerTestSuite) TestFetchIPRangesWithContext() {
	// Setup mock server
	suite.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("103.21.244.0/22\n103.21.248.0/22"))
	}))

	ctx := context.Background()
	ranges, err := suite.checker.fetchIPRangesWithContext(ctx, suite.server.URL)
	assert.NoError(suite.T(), err)
	assert.Len(suite.T(), ranges, 2)
	assert.Contains(suite.T(), ranges, "103.21.244.0/22")
	assert.Contains(suite.T(), ranges, "103.21.248.0/22")
}

func TestDNSCheckerSuite(t *testing.T) {
	suite.Run(t, new(DNSCheckerTestSuite))
}
