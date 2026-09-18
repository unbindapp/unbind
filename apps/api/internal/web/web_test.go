package web

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHandler(t *testing.T) {
	h := Handler()

	tests := []struct {
		name       string
		method     string
		path       string
		accept     string
		wantStatus int
		wantHTML   bool
	}{
		{"root serves index", http.MethodGet, "/", "text/html", http.StatusOK, true},
		{"client route falls back to index", http.MethodGet, "/sign-in", "text/html", http.StatusOK, true},
		{"unknown non-html path is 404", http.MethodGet, "/teams/nope", "application/json", http.StatusNotFound, false},
		{"post is rejected", http.MethodPost, "/", "text/html", http.StatusMethodNotAllowed, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			req.Header.Set("Accept", tt.accept)
			rec := httptest.NewRecorder()

			h.ServeHTTP(rec, req)

			if rec.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d", rec.Code, tt.wantStatus)
			}
			if tt.wantHTML {
				if ct := rec.Header().Get("Content-Type"); !strings.Contains(ct, "text/html") {
					t.Fatalf("content-type = %q, want text/html", ct)
				}
				if cc := rec.Header().Get("Cache-Control"); !strings.Contains(cc, "no-store") {
					t.Fatalf("index Cache-Control = %q, want no-store", cc)
				}
				if !strings.Contains(rec.Body.String(), `id="root"`) {
					t.Fatalf("index body missing app root element")
				}
			}
		})
	}
}

func TestConsentPageRefusesFraming(t *testing.T) {
	h := Handler()
	for path, framed := range map[string]bool{"/oauth/consent": false, "/oauth/consent/": false, "/sign-in": true} {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		req.Header.Set("Accept", "text/html")
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)

		csp := rec.Header().Get("Content-Security-Policy")
		if framed && csp != "" {
			t.Fatalf("%s: unexpected CSP %q", path, csp)
		}
		if !framed && csp != "frame-ancestors 'none'" {
			t.Fatalf("%s: CSP = %q, want frame-ancestors 'none'", path, csp)
		}
	}
}
