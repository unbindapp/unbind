package github

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/unbindapp/unbind-api/config"
	"github.com/unbindapp/unbind-api/ent"
)

func testPrivateKeyPEM(t *testing.T) string {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)
	return string(pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(key)}))
}

type hookConfigServer struct {
	*httptest.Server
	currentURL string
	patched    []string
}

func newHookConfigServer(t *testing.T, currentURL string) *hookConfigServer {
	t.Helper()
	s := &hookConfigServer{currentURL: currentURL}
	mux := http.NewServeMux()
	mux.HandleFunc("/api/v3/app/hook/config", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") == "" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		switch r.Method {
		case http.MethodGet:
			_ = json.NewEncoder(w).Encode(map[string]string{"url": s.currentURL})
		case http.MethodPatch:
			var body map[string]string
			require.NoError(t, json.NewDecoder(r.Body).Decode(&body))
			s.patched = append(s.patched, body["url"])
			s.currentURL = body["url"]
			_ = json.NewEncoder(w).Encode(map[string]string{"url": s.currentURL})
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})
	s.Server = httptest.NewServer(mux)
	t.Cleanup(s.Close)
	return s
}

func TestSyncWebhookURLs(t *testing.T) {
	const wanted = "https://unbind.example.com/api/go/github/webhook"
	key := testPrivateKeyPEM(t)

	t.Run("rewrites an outdated url", func(t *testing.T) {
		server := newHookConfigServer(t, "https://unbind.example.com/api/go/webhook/github")
		client := NewGithubClient(server.URL, &config.Config{GithubWebhookURL: wanted})

		client.SyncWebhookURLs(context.Background(), []*ent.GithubApp{{ID: 1, Name: "unbind", PrivateKey: key}})

		require.Equal(t, []string{wanted}, server.patched)
	})

	t.Run("leaves a current url alone", func(t *testing.T) {
		server := newHookConfigServer(t, wanted)
		client := NewGithubClient(server.URL, &config.Config{GithubWebhookURL: wanted})

		client.SyncWebhookURLs(context.Background(), []*ent.GithubApp{{ID: 1, Name: "unbind", PrivateKey: key}})

		require.Empty(t, server.patched)
	})

	t.Run("a broken app does not stop the others", func(t *testing.T) {
		server := newHookConfigServer(t, "https://old.example.com/webhook/github")
		client := NewGithubClient(server.URL, &config.Config{GithubWebhookURL: wanted})

		client.SyncWebhookURLs(context.Background(), []*ent.GithubApp{
			{ID: 1, Name: "broken", PrivateKey: "not a key"},
			{ID: 2, Name: "unbind", PrivateKey: key},
		})

		require.Equal(t, []string{wanted}, server.patched)
	})
}
