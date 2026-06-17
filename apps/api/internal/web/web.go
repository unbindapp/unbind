package web

import (
	"io/fs"
	"net/http"
	"path"
	"strings"
)

// Handler serves the embedded SPA build. Hashed assets are cached immutably,
// config.json is never cached, and any path without a matching file falls back
// to index.html so client-side routing works. Mirrors the old nginx.conf rules.
//
// Non-HTML requests (e.g. API fetches with Accept: application/json) that match
// no file get a plain 404 rather than the HTML shell, so unknown API paths still
// read as errors to clients.
func Handler() http.Handler {
	dist, err := fs.Sub(distFS, "dist")
	if err != nil {
		panic(err)
	}

	index, err := fs.ReadFile(dist, "index.html")
	if err != nil {
		panic(err)
	}

	fileServer := http.FileServer(http.FS(dist))

	serveIndex := func(w http.ResponseWriter, r *http.Request) {
		if !strings.Contains(r.Header.Get("Accept"), "text/html") {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write(index)
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		name := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
		if name == "" {
			serveIndex(w, r)
			return
		}

		f, err := dist.Open(name)
		if err != nil {
			serveIndex(w, r)
			return
		}
		stat, err := f.Stat()
		f.Close()
		if err != nil || stat.IsDir() {
			serveIndex(w, r)
			return
		}

		switch {
		case name == "config.json":
			w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
		case strings.HasPrefix(name, "assets/"):
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		}
		fileServer.ServeHTTP(w, r)
	})
}
