package registrycache

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTagsNullList(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/v2/tezara/tags/list", r.URL.Path)
		w.Write([]byte(`{"name":"tezara","tags":null}`))
	}))
	defer server.Close()

	tags, err := NewClient(server.URL).Tags(context.Background(), "tezara")

	require.NoError(t, err)
	assert.Empty(t, tags)
}

func TestManifestReturnsDigestAndBlobs(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set(digestHeader, "sha256:manifest")
		w.Write([]byte(`{"config":{"digest":"sha256:config","size":10},"layers":[{"digest":"sha256:layer","size":90}]}`))
	}))
	defer server.Close()

	client := NewClient(server.URL)
	manifest, err := client.Manifest(context.Background(), "tezara", "abc")
	require.NoError(t, err)
	assert.Equal(t, "sha256:manifest", manifest.Digest)

	blobs := map[string]int64{}
	require.NoError(t, collectBlobs(context.Background(), client, "tezara", "abc", blobs, 0))
	assert.Equal(t, map[string]int64{"sha256:config": 10, "sha256:layer": 90}, blobs)
}

func TestCollectBlobsWalksImageIndex(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/v2/tezara/manifests/multi":
			w.Write([]byte(`{"manifests":[{"digest":"sha256:amd64"},{"digest":"sha256:arm64"}]}`))
		case "/v2/tezara/manifests/sha256:amd64":
			w.Write([]byte(`{"config":{"digest":"sha256:c1","size":1},"layers":[{"digest":"sha256:shared","size":50}]}`))
		case "/v2/tezara/manifests/sha256:arm64":
			w.Write([]byte(`{"config":{"digest":"sha256:c2","size":2},"layers":[{"digest":"sha256:shared","size":50}]}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	blobs := map[string]int64{}
	err := collectBlobs(context.Background(), NewClient(server.URL), "tezara", "multi", blobs, 0)

	require.NoError(t, err)
	assert.Equal(t, map[string]int64{"sha256:c1": 1, "sha256:c2": 2, "sha256:shared": 50}, blobs)
}

func TestDeleteManifestToleratesMissingManifest(t *testing.T) {
	var seen string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seen = r.Method + " " + r.URL.Path
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	err := NewClient(server.URL).DeleteManifest(context.Background(), "tezara", "sha256:gone")

	require.NoError(t, err)
	assert.Equal(t, "DELETE /v2/tezara/manifests/sha256:gone", seen)
}

func TestDeleteManifestSurfacesErrors(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusMethodNotAllowed)
		w.Write([]byte(`{"errors":[{"code":"UNSUPPORTED"}]}`))
	}))
	defer server.Close()

	err := NewClient(server.URL).DeleteManifest(context.Background(), "tezara", "sha256:abc")

	require.ErrorContains(t, err, "405")
}

func fakeRegistry(t *testing.T, missing string, status int) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == missing {
			w.WriteHeader(status)
			return
		}
		switch r.URL.Path {
		case "/v2/tezara/manifests/abc":
			w.Write([]byte(`{"manifests":[{"digest":"sha256:image"}]}`))
		case "/v2/tezara/manifests/sha256:image":
			w.Write([]byte(`{"config":{"digest":"sha256:config"},"layers":[{"digest":"sha256:layer"}]}`))
		case "/v2/tezara/blobs/sha256:config", "/v2/tezara/blobs/sha256:layer":
		default:
			t.Errorf("unexpected request %s", r.URL.Path)
		}
	}))
}

func TestVerifyImage(t *testing.T) {
	cases := map[string]struct {
		missing    string
		status     int
		incomplete bool
		fails      bool
	}{
		"complete image":              {},
		"missing layer":               {missing: "/v2/tezara/blobs/sha256:layer", status: http.StatusNotFound, incomplete: true, fails: true},
		"missing config":              {missing: "/v2/tezara/blobs/sha256:config", status: http.StatusNotFound, incomplete: true, fails: true},
		"missing child manifest":      {missing: "/v2/tezara/manifests/sha256:image", status: http.StatusNotFound, incomplete: true, fails: true},
		"registry error is not a gap": {missing: "/v2/tezara/blobs/sha256:layer", status: http.StatusInternalServerError, fails: true},
	}

	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			server := fakeRegistry(t, tc.missing, tc.status)
			defer server.Close()

			err := NewClient(server.URL).VerifyImage(context.Background(), "tezara", "abc")

			assert.Equal(t, tc.fails, err != nil)
			assert.Equal(t, tc.incomplete, errors.Is(err, ErrImageIncomplete))
		})
	}
}
