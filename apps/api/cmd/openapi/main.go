// Prints the OpenAPI spec built from the current API code to stdout, without
// standing up a server, database, or kube client. Used to regenerate the web
// client types. Usage: go run ./cmd/openapi > openapi.yaml
//
// With -api-key-only it prints the spec for the public API reference instead:
// only the operations an API key can call.
package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humachi"
	"github.com/go-chi/chi/v5"
	"github.com/unbindapp/unbind-api/config"
	"github.com/unbindapp/unbind-api/internal/api/middleware"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/router"
	"github.com/unbindapp/unbind-api/internal/api/server"
)

func main() {
	apiKeyOnly := flag.Bool("api-key-only", false, "only include operations an API key can call")
	flag.Parse()

	cfg := &config.Config{}

	r := chi.NewRouter()
	humaCfg := router.NewHumaConfig("Unbind API", "1.0.0", cfg.CookieSecure)
	api := humachi.New(r, humaCfg)

	mw := middleware.NewMiddleware(cfg, nil, api, nil, nil)
	router.RegisterRoutes(api, &server.Server{}, mw, nil)

	if *apiKeyOnly {
		keepAPIKeyOperations(api.OpenAPI())
	}

	spec, err := api.OpenAPI().YAML()
	if err != nil {
		fmt.Fprintln(os.Stderr, "failed to render OpenAPI spec:", err)
		os.Exit(1)
	}

	if _, err := os.Stdout.Write(spec); err != nil {
		os.Exit(1)
	}
}

func keepAPIKeyOperations(spec *huma.OpenAPI) {
	bearerOnly := []map[string][]string{{"bearerAuth": {}}}

	for path, item := range spec.Paths {
		operations := []**huma.Operation{&item.Get, &item.Post, &item.Put, &item.Patch, &item.Delete}
		kept := 0
		for _, operation := range operations {
			if *operation == nil {
				continue
			}
			if len((*operation).Security) == 0 || oapi.IsSessionOnly(*operation) {
				*operation = nil
				continue
			}
			(*operation).Security = bearerOnly
			kept++
		}
		if kept == 0 {
			delete(spec.Paths, path)
		}
	}

	delete(spec.Components.SecuritySchemes, "cookieAuth")
	spec.Servers = []*huma.Server{{
		URL: "https://{domain}/api/go",
		Variables: map[string]*huma.ServerVariable{
			"domain": {Default: "unbind.example.com", Description: "The domain of your Unbind instance."},
		},
	}}
}
