package cloudinfo

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestProviderFromVendor(t *testing.T) {
	cases := map[string]struct {
		provider Provider
		found    bool
	}{
		"Hetzner\n":            {Hetzner, true},
		"DigitalOcean":         {DigitalOcean, true},
		"QEMU":                 {"", false},
		"ASUSTeK COMPUTER INC": {"", false},
		"":                     {"", false},
	}
	for vendor, want := range cases {
		got, found := providerFromVendor(vendor)
		assert.Equal(t, want.found, found, vendor)
		assert.Equal(t, want.provider, got, vendor)
	}
}

func TestEveryProviderHasASpec(t *testing.T) {
	for _, spec := range specs {
		assert.NotEmpty(t, spec.Provisioner, spec.Provider)
		assert.NotEmpty(t, spec.StorageClass, spec.Provider)
		assert.Positive(t, spec.MinGB, spec.Provider)
		assert.Positive(t, spec.MaxPerServer, spec.Provider)
		assert.NotEmpty(t, spec.PricePerGB, spec.Provider)
		assert.Equal(t, spec, spec.Provider.Spec())
	}
}

func withMetadata(t *testing.T, handler http.HandlerFunc) {
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)
	orig := metadataBase
	metadataBase = server.URL
	t.Cleanup(func() { metadataBase = orig })
}

func withSysVendor(t *testing.T, vendor string) {
	path := filepath.Join(t.TempDir(), "sys_vendor")
	require.NoError(t, os.WriteFile(path, []byte(vendor+"\n"), 0o644))
	orig := sysVendorPath
	sysVendorPath = path
	t.Cleanup(func() { sysVendorPath = orig })
}

func TestDetectHetzner(t *testing.T) {
	withSysVendor(t, "Hetzner")
	withMetadata(t, func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/hetzner/v1/metadata/instance-id", r.URL.Path)
		w.Write([]byte("12345\n"))
	})

	info := Detect(context.Background(), func(string) {})
	require.NotNil(t, info)
	assert.Equal(t, Hetzner, info.Provider)
	assert.Equal(t, "12345", info.InstanceID)
}

func TestDetectDigitalOcean(t *testing.T) {
	withSysVendor(t, "DigitalOcean")
	withMetadata(t, func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/metadata/v1.json", r.URL.Path)
		w.Write([]byte(`{"droplet_id":98765,"hostname":"droplet","region":"fra1"}`))
	})

	info := Detect(context.Background(), func(string) {})
	require.NotNil(t, info)
	assert.Equal(t, DigitalOcean, info.Provider)
	assert.Equal(t, "98765", info.InstanceID)
	assert.Equal(t, "fra1", info.Region)
}

func TestDetectKeepsProviderWhenMetadataFails(t *testing.T) {
	withSysVendor(t, "Hetzner")
	withMetadata(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	})

	var logged []string
	info := Detect(context.Background(), func(msg string) { logged = append(logged, msg) })
	require.NotNil(t, info)
	assert.Equal(t, Hetzner, info.Provider)
	assert.Empty(t, info.InstanceID)
	assert.Contains(t, logged[len(logged)-1], "Warning")
}

func TestDetectUnknownVendor(t *testing.T) {
	withSysVendor(t, "QEMU")
	assert.Nil(t, Detect(context.Background(), func(string) {}))
}

func TestDetectWithoutDMI(t *testing.T) {
	orig := sysVendorPath
	sysVendorPath = filepath.Join(t.TempDir(), "missing")
	t.Cleanup(func() { sysVendorPath = orig })
	assert.Nil(t, Detect(context.Background(), func(string) {}))
}
