// Prints the OpenAPI spec built from the current API code to stdout, without
// standing up a server, database, or kube client. Used to regenerate the web
// client types. Usage: go run ./cmd/openapi > openapi.yaml
package main

import (
	"fmt"
	"os"

	"github.com/danielgtaylor/huma/v2/adapters/humachi"
	"github.com/go-chi/chi/v5"
	"github.com/unbindapp/unbind-api/config"
	"github.com/unbindapp/unbind-api/internal/api/middleware"
	"github.com/unbindapp/unbind-api/internal/api/router"
	"github.com/unbindapp/unbind-api/internal/api/server"
)

func main() {
	cfg := &config.Config{}

	r := chi.NewRouter()
	humaCfg := router.NewHumaConfig("Unbind API", "1.0.0", cfg.CookieSecure)
	api := humachi.New(r, humaCfg)

	mw := middleware.NewMiddleware(cfg, nil, api, nil, nil)
	router.RegisterRoutes(api, &server.Server{}, mw, nil)

	spec, err := api.OpenAPI().YAML()
	if err != nil {
		fmt.Fprintln(os.Stderr, "failed to render OpenAPI spec:", err)
		os.Exit(1)
	}

	if _, err := os.Stdout.Write(spec); err != nil {
		os.Exit(1)
	}
}
