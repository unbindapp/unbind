package cloudinfo

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func hetznerAPI(t *testing.T, serverStatus int, pricing string) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "Bearer secret", r.Header.Get("Authorization"))
		switch r.URL.Path {
		case "/servers/42":
			w.WriteHeader(serverStatus)
		case "/pricing":
			w.Write([]byte(pricing))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(server.Close)
	orig := hetznerAPIBase
	hetznerAPIBase = server.URL
	t.Cleanup(func() { hetznerAPIBase = orig })
}

func TestCheckTokenHetznerWithLivePrice(t *testing.T) {
	hetznerAPI(t, http.StatusOK, `{"pricing":{"volume":{"price_per_gb_month":{"net":"0.0572","gross":"0.0681"}}}}`)

	check, err := checkToken(context.Background(), http.DefaultClient, &Info{Provider: Hetzner, InstanceID: "42"}, "secret")
	require.NoError(t, err)
	assert.Equal(t, "€0.0572", check.VolumePricePerGB)
}

func TestCheckTokenHetznerWithoutPrice(t *testing.T) {
	hetznerAPI(t, http.StatusOK, `not json`)

	check, err := checkToken(context.Background(), http.DefaultClient, &Info{Provider: Hetzner, InstanceID: "42"}, "secret")
	require.NoError(t, err)
	assert.Empty(t, check.VolumePricePerGB)
}

func TestCheckTokenRejected(t *testing.T) {
	hetznerAPI(t, http.StatusUnauthorized, "")
	_, err := checkToken(context.Background(), http.DefaultClient, &Info{Provider: Hetzner, InstanceID: "42"}, "secret")
	assert.ErrorIs(t, err, ErrInvalidToken)
}

func TestCheckTokenWrongProject(t *testing.T) {
	hetznerAPI(t, http.StatusNotFound, "")
	_, err := checkToken(context.Background(), http.DefaultClient, &Info{Provider: Hetzner, InstanceID: "42"}, "secret")
	assert.ErrorIs(t, err, ErrWrongProject)
}

func TestCheckTokenDigitalOcean(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/droplets/7", r.URL.Path)
		assert.Equal(t, "Bearer secret", r.Header.Get("Authorization"))
		w.WriteHeader(http.StatusForbidden)
	}))
	t.Cleanup(server.Close)
	orig := digitalOceanAPIBase
	digitalOceanAPIBase = server.URL
	t.Cleanup(func() { digitalOceanAPIBase = orig })

	_, err := checkToken(context.Background(), http.DefaultClient, &Info{Provider: DigitalOcean, InstanceID: "7"}, "secret")
	assert.ErrorIs(t, err, ErrInvalidToken)
}

func TestCheckTokenWithoutInstanceID(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/pricing" {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		assert.Equal(t, "/servers", r.URL.Path)
		assert.Equal(t, "1", r.URL.Query().Get("per_page"))
	}))
	t.Cleanup(server.Close)
	orig := hetznerAPIBase
	hetznerAPIBase = server.URL
	t.Cleanup(func() { hetznerAPIBase = orig })

	_, err := checkToken(context.Background(), http.DefaultClient, &Info{Provider: Hetzner}, "secret")
	require.NoError(t, err)
}
