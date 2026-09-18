package oauthserver

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/unbindapp/unbind-api/internal/infrastructure/cache"
)

const claudeCodeDocument = `{
  "client_id": "%s",
  "client_name": "Claude Code",
  "client_uri": "https://claude.ai",
  "redirect_uris": ["http://localhost/callback", "http://127.0.0.1/callback"],
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none"
}`

type documentServer struct {
	*httptest.Server
	hits    atomic.Int32
	body    func(clientID string) string
	headers http.Header
	status  int
}

func newDocumentServer(t *testing.T) *documentServer {
	t.Helper()
	ds := &documentServer{status: http.StatusOK, headers: http.Header{}}
	ds.body = func(clientID string) string { return strings.ReplaceAll(claudeCodeDocument, "%s", clientID) }
	ds.Server = httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ds.hits.Add(1)
		for key, values := range ds.headers {
			w.Header()[key] = values
		}
		w.WriteHeader(ds.status)
		_, _ = w.Write([]byte(ds.body(ds.URL + r.URL.Path)))
	}))
	t.Cleanup(ds.Close)
	return ds
}

func newTestFetcher(t *testing.T, ds *documentServer) (*MetadataFetcher, *miniredis.Miniredis) {
	t.Helper()
	mr := miniredis.RunT(t)
	store := cache.NewCache[ClientMetadata](redis.NewClient(&redis.Options{Addr: mr.Addr()}), "cimd")
	client := ds.Client()
	transport := client.Transport.(*http.Transport).Clone()
	transport.DialContext = SafeDialContext(AllowAllIPPolicy)
	client.Transport = transport
	client.CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }
	client.Timeout = metadataDocumentTimeout
	return &MetadataFetcher{client: client, cache: store}, mr
}

func TestIsMetadataDocumentClientID(t *testing.T) {
	assert.True(t, IsMetadataDocumentClientID("https://claude.ai/oauth/claude-code-client-metadata"))
	assert.True(t, IsMetadataDocumentClientID("https://example.com:8443/client.json"))
	for _, id := range []string{
		"", "abc-123", "http://claude.ai/oauth/client", "https://claude.ai", "https://claude.ai/",
		"https://claude.ai/a/../b", "https://claude.ai/x#frag", "https://u:p@claude.ai/x",
		"https://" + strings.Repeat("a", 600) + "/x",
	} {
		assert.False(t, IsMetadataDocumentClientID(id), id)
	}
}

func TestFetchValidatesAndCaches(t *testing.T) {
	ds := newDocumentServer(t)
	ds.headers.Set("Cache-Control", "public, max-age=7200")
	fetcher, mr := newTestFetcher(t, ds)
	clientID := ds.URL + "/oauth/client-metadata"

	doc, err := fetcher.Fetch(context.Background(), clientID)
	require.NoError(t, err)
	assert.Equal(t, clientID, doc.ClientID)
	assert.Equal(t, "Claude Code", doc.ClientName)
	assert.Equal(t, []string{"http://localhost/callback", "http://127.0.0.1/callback"}, doc.RedirectURIs)

	again, err := fetcher.Fetch(context.Background(), clientID)
	require.NoError(t, err)
	assert.Equal(t, doc, again)
	assert.Equal(t, int32(1), ds.hits.Load())
	assert.InDelta(t, (2 * time.Hour).Seconds(), mr.TTL("cimd:"+clientID).Seconds(), 5)
}

func TestFetchRejectsBadDocuments(t *testing.T) {
	cases := map[string]struct {
		body   func(string) string
		status int
		want   string
	}{
		"client id mismatch": {func(id string) string { return strings.ReplaceAll(claudeCodeDocument, "%s", id+"x") }, 200, "does not match"},
		"not json":           {func(string) string { return "<html>" }, 200, "not valid json"},
		"too large":          {func(id string) string { return `{"client_id":"` + id + `","pad":"` + strings.Repeat("x", 9000) + `"}` }, 200, "too large"},
		"no redirects":       {func(id string) string { return `{"client_id":"` + id + `","client_name":"x"}` }, 200, "no redirect_uris"},
		"bad redirect":       {func(id string) string { return `{"client_id":"` + id + `","redirect_uris":["http://evil.com/cb"]}` }, 200, "redirect_uris"},
		"confidential": {func(id string) string {
			return `{"client_id":"` + id + `","redirect_uris":["https://a.com/cb"],"token_endpoint_auth_method":"client_secret_basic"}`
		}, 200, "public clients"},
		"not found": {func(string) string { return "" }, 404, "answered 404"},
		"redirect":  {func(string) string { return "" }, 302, "answered 302"},
	}
	for name, c := range cases {
		ds := newDocumentServer(t)
		ds.body = c.body
		ds.status = c.status
		fetcher, mr := newTestFetcher(t, ds)
		clientID := ds.URL + "/client.json"

		_, err := fetcher.Fetch(context.Background(), clientID)
		require.Error(t, err, name)
		assert.ErrorContains(t, err, c.want, name)
		assert.False(t, mr.Exists("cimd:"+clientID), "%s must not be cached", name)
	}
}

func TestFetchRejectsNonDocumentClientID(t *testing.T) {
	fetcher, _ := newTestFetcher(t, newDocumentServer(t))
	_, err := fetcher.Fetch(context.Background(), "abc-123")
	assert.ErrorContains(t, err, "not a metadata document url")
}

func TestCacheTTLClamp(t *testing.T) {
	assert.Equal(t, time.Hour, cacheTTL(""))
	assert.Equal(t, time.Hour, cacheTTL("no-store"))
	assert.Equal(t, 5*time.Minute, cacheTTL("max-age=60"))
	assert.Equal(t, 24*time.Hour, cacheTTL("max-age=604800"))
	assert.Equal(t, 2*time.Hour, cacheTTL("public, max-age=7200, must-revalidate"))
	assert.Equal(t, 2*time.Hour, cacheTTL("Max-Age=7200"))
	assert.Equal(t, time.Hour, cacheTTL("s-maxage=10"))
}

func TestFetchDefaultsNameToHost(t *testing.T) {
	ds := newDocumentServer(t)
	ds.body = func(id string) string { return `{"client_id":"` + id + `","redirect_uris":["https://a.com/cb"]}` }
	fetcher, _ := newTestFetcher(t, ds)
	doc, err := fetcher.Fetch(context.Background(), ds.URL+"/c.json")
	require.NoError(t, err)
	assert.Equal(t, strings.TrimPrefix(ds.URL, "https://"), doc.ClientName)
}
