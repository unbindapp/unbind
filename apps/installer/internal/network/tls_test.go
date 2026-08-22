package network

import (
	"net"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestServesTLS(t *testing.T) {
	discard := func(string) {}

	tlsServer := httptest.NewTLSServer(http.NotFoundHandler())
	defer tlsServer.Close()
	assert.True(t, ServesTLS(tlsServer.Listener.Addr().String(), "probe.example.com", discard))

	plainServer := httptest.NewServer(http.NotFoundHandler())
	defer plainServer.Close()
	assert.False(t, ServesTLS(plainServer.Listener.Addr().String(), "probe.example.com", discard))

	closed, err := net.Listen("tcp", "127.0.0.1:0")
	assert.NoError(t, err)
	addr := closed.Addr().String()
	closed.Close()
	assert.False(t, ServesTLS(addr, "probe.example.com", discard))
}
