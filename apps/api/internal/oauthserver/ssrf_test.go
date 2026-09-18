package oauthserver

import (
	"context"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDefaultIPPolicy(t *testing.T) {
	blocked := []string{
		"127.0.0.1", "127.8.8.8", "10.0.0.1", "172.16.0.1", "172.31.255.255", "192.168.1.1",
		"169.254.169.254", "0.0.0.0", "0.1.2.3", "100.64.0.1", "192.0.0.1", "198.18.0.1",
		"224.0.0.1", "255.255.255.255", "240.0.0.1",
		"::1", "::", "fe80::1", "fc00::1", "fd12::1", "ff02::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1",
	}
	for _, raw := range blocked {
		ip := net.ParseIP(raw)
		require.NotNil(t, ip, raw)
		assert.False(t, DefaultIPPolicy(ip), raw)
	}

	allowed := []string{"1.1.1.1", "8.8.8.8", "104.18.32.7", "2606:4700::6810:2007"}
	for _, raw := range allowed {
		assert.True(t, DefaultIPPolicy(net.ParseIP(raw)), raw)
	}
}

func TestSafeDialContextHonoursPolicy(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	defer srv.Close()
	addr := srv.Listener.Addr().String()

	_, err := SafeDialContext(DefaultIPPolicy)(context.Background(), "tcp", addr)
	assert.ErrorContains(t, err, "not allowed")

	conn, err := SafeDialContext(AllowAllIPPolicy)(context.Background(), "tcp", addr)
	require.NoError(t, err)
	conn.Close()

	_, err = SafeDialContext(AllowAllIPPolicy)(context.Background(), "tcp", "localhost")
	assert.Error(t, err)
}
