// Package mcpserver serves Unbind's MCP endpoint. Its tools are the API
// operations registered with oapi.MCP, called in process through the API
// router, so a tool validates, authorizes and answers exactly like its endpoint.
package mcpserver

import (
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/go-chi/chi/v5"
	"github.com/modelcontextprotocol/go-sdk/auth"
	"github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/unbindapp/unbind-api/internal/api/middleware"
	"github.com/unbindapp/unbind-api/internal/oauthserver"
)

const (
	maxRequestBodyBytes = 1 << 20
	requestsPerMinute   = 600

	instructions = `Unbind is a self-hosted platform that builds and runs services on Kubernetes.

Resources nest as team > project > environment > service, and most tools need the IDs of every level above the resource they act on. Find them with list-teams, list-projects, list-environments and list-service.

Names are unique among siblings and case sensitive: projects in a team, environments in a project, services, service groups and volumes in an environment. Creating or renaming into a taken name answers "conflict", except create-service, create-service-group, create-volume and deploy-template, which keep going with a short suffix added to the name. Read the name from their response instead of assuming the one you sent.

Call whoami first: when api_key is present, this connection is limited to the listed role and resources, and anything outside them answers "not found" or "forbidden".

Creating or updating a service does not roll it out. Call trigger-deployment, then poll get-deployment until it finishes, and read query-logs when a build or a replica fails. Variable changes are rolled out by the next deployment.`
)

type Options struct {
	API huma.API
	// Router serves the API operations that tool calls are dispatched to.
	Router  http.Handler
	OAuth   AccessTokenVerifier
	APIKeys APIKeyStore
	Issuer  string
	Version string
}

type Server struct {
	handler http.Handler
	tools   []*tool
}

func New(opts Options) (*Server, error) {
	tools, err := buildTools(opts.API)
	if err != nil {
		return nil, err
	}

	dispatch := &dispatcher{router: opts.Router}
	readWrite := newMCPServer(opts.Version, tools, dispatch, false)
	readOnly := newMCPServer(opts.Version, tools, dispatch, true)

	streamable := mcp.NewStreamableHTTPHandler(func(r *http.Request) *mcp.Server {
		caller, ok := callerOf(auth.TokenInfoFromContext(r.Context()))
		if ok && !caller.Access.AllowsWrites() {
			return readOnly
		}
		return readWrite
	}, &mcp.StreamableHTTPOptions{
		Stateless:           true,
		JSONResponse:        true,
		MaxRequestBodyBytes: maxRequestBodyBytes,
	})

	verifier := newVerifier(opts.OAuth, opts.APIKeys, time.Now)
	handler := auth.RequireBearerToken(verifier, &auth.RequireBearerTokenOptions{
		ResourceMetadataURL:    oauthserver.ResourceMetadataURL(opts.Issuer),
		AllowMissingExpiration: true,
	})(streamable)

	return &Server{handler: handler, tools: tools}, nil
}

func (self *Server) Mount(r chi.Router, limiter *middleware.RateLimiter) {
	r.With(limiter.Limit("mcp", requestsPerMinute, time.Minute)).Handle("/mcp", self.handler)
}

// newMCPServer registers the tools a connection may see. Read only connections
// are not offered tools the auth middleware would refuse anyway.
func newMCPServer(version string, tools []*tool, dispatch *dispatcher, readOnly bool) *mcp.Server {
	server := mcp.NewServer(&mcp.Implementation{Name: "unbind", Title: "Unbind", Version: version}, &mcp.ServerOptions{
		Instructions: instructions,
	})
	for _, t := range tools {
		if readOnly && !t.readOnly {
			continue
		}
		server.AddTool(t.definition, dispatch.handlerFor(t))
	}
	return server
}
