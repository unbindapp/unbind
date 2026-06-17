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
