package registry

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseBearerChallenge(t *testing.T) {
	tests := []struct {
		name   string
		header string
		want   bearerChallenge
		ok     bool
	}{
		{
			name:   "docker hub",
			header: `Bearer realm="https://auth.docker.io/token",service="registry.docker.io"`,
			want:   bearerChallenge{realm: "https://auth.docker.io/token", service: "registry.docker.io"},
			ok:     true,
		},
		{
			name:   "ghcr",
			header: `Bearer realm="https://ghcr.io/token",service="ghcr.io",scope="repository:user/image:pull"`,
			want:   bearerChallenge{realm: "https://ghcr.io/token", service: "ghcr.io", scope: "repository:user/image:pull"},
			ok:     true,
		},
		{
			name:   "quay",
			header: `Bearer realm="https://quay.io/v2/auth",service="quay.io"`,
			want:   bearerChallenge{realm: "https://quay.io/v2/auth", service: "quay.io"},
			ok:     true,
		},
		{
			name:   "basic challenge",
			header: `Basic realm="Registry"`,
			ok:     false,
		},
		{
			name:   "empty",
			header: "",
			ok:     false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := parseBearerChallenge(tt.header)
			assert.Equal(t, tt.ok, ok)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestTokenURL(t *testing.T) {
	c := bearerChallenge{realm: "https://auth.example.com/token", service: "registry.example.com", scope: "repository:a/b:pull"}
	u, err := c.tokenURL()
	require.NoError(t, err)
	assert.Equal(t, "https://auth.example.com/token?scope=repository%3Aa%2Fb%3Apull&service=registry.example.com", u)

	u, err = bearerChallenge{realm: "https://auth.example.com/token"}.tokenURL()
	require.NoError(t, err)
	assert.Equal(t, "https://auth.example.com/token", u)
}

func newFakeRegistry(t *testing.T, directOK bool) *httptest.Server {
	t.Helper()
	var srv *httptest.Server
	mux := http.NewServeMux()
	mux.HandleFunc("/v2/", func(w http.ResponseWriter, r *http.Request) {
		user, pass, ok := r.BasicAuth()
		if directOK && ok && user == "alice" && pass == "secret" {
			w.WriteHeader(http.StatusOK)
			return
		}
		w.Header().Set("WWW-Authenticate", `Bearer realm="`+srv.URL+`/token",service="fake"`)
		w.WriteHeader(http.StatusUnauthorized)
	})
	mux.HandleFunc("/token", func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "fake", r.URL.Query().Get("service"))
		user, pass, ok := r.BasicAuth()
		if !ok || user != "alice" || pass != "secret" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		w.WriteHeader(http.StatusOK)
	})
	srv = httptest.NewTLSServer(mux)
	t.Cleanup(srv.Close)
	return srv
}

func TestCheckCredentials(t *testing.T) {
	ctx := context.Background()

	t.Run("valid via token flow", func(t *testing.T) {
		srv := newFakeRegistry(t, false)
		assert.NoError(t, checkCredentials(ctx, srv.Client(), srv.URL, "alice", "secret"))
	})

	t.Run("invalid via token flow", func(t *testing.T) {
		srv := newFakeRegistry(t, false)
		err := checkCredentials(ctx, srv.Client(), srv.URL, "alice", "wrong")
		assert.True(t, errors.Is(err, ErrInvalidCredentials))
	})

	t.Run("valid via direct basic auth", func(t *testing.T) {
		srv := newFakeRegistry(t, true)
		assert.NoError(t, checkCredentials(ctx, srv.Client(), srv.URL, "alice", "secret"))
	})

	t.Run("unreachable", func(t *testing.T) {
		err := checkCredentials(ctx, http.DefaultClient, "https://127.0.0.1:1", "alice", "secret")
		assert.Error(t, err)
		assert.False(t, errors.Is(err, ErrInvalidCredentials))
	})
}

func TestAPIHost(t *testing.T) {
	assert.Equal(t, "registry-1.docker.io", apiHost("docker.io"))
	assert.Equal(t, "registry-1.docker.io", apiHost("index.docker.io"))
	assert.Equal(t, "ghcr.io", apiHost("ghcr.io"))
	assert.Equal(t, "registry.example.com", apiHost("https://registry.example.com/"))
}
