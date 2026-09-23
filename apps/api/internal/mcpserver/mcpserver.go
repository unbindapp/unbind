// Package mcpserver serves Unbind's MCP endpoint. Its tools are the API
// operations registered with oapi.MCP, called in process through the API
// router, so a tool validates, authorizes and answers exactly like its endpoint.
package mcpserver

import (
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/go-chi/chi/v5"
	"github.com/modelcontextprotocol/go-sdk/auth"
	"github.com/modelcontextprotocol/go-sdk/mcp"
	entSchema "github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/api/middleware"
	"github.com/unbindapp/unbind-api/internal/oauthserver"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

const (
	maxRequestBodyBytes = 1 << 20
	requestsPerMinute   = 600

	instructions = `Unbind is a self-hosted platform that builds and runs services on Kubernetes.

Resources nest as team > project > environment > service, and most tools need the IDs of every level above the resource they act on. Find them with list-teams, list-projects, list-environments and list-service.

Names are unique among siblings and case sensitive: projects in a team, environments in a project, services, service groups and volumes in an environment. Creating or renaming into a taken name answers "conflict", except create-service, create-service-group, create-volume and deploy-template, which keep going with a short suffix added to the name. Read the name from their response instead of assuming the one you sent.

Call whoami first: when api_key is present, this connection is limited to the listed role, resources and capabilities. Anything outside the role or resources answers "not found" or "forbidden". Without the variable_values capability, variable values come back blank but names and references are listed; without webhook_urls, webhook URLs come back blank; without logs, there is no query-logs tool. Do not retry for values that are redacted.

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

	servers := &serverSet{
		version:  opts.Version,
		tools:    tools,
		dispatch: &dispatcher{router: opts.Router},
		servers:  map[string]*mcp.Server{},
	}

	streamable := mcp.NewStreamableHTTPHandler(func(r *http.Request) *mcp.Server {
		caller, ok := callerOf(auth.TokenInfoFromContext(r.Context()))
		if !ok {
			return servers.serverFor(everything)
		}
		return servers.serverFor(caller.Access)
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

// everything is the access of a caller nothing narrows, which only the
// verifier's own failures leave us with; the auth middleware still decides.
var everything = permissions_repo.APIKeyAccess{
	Role:         entSchema.ActionAdmin,
	FullAccess:   true,
	Capabilities: []entSchema.KeyCapability{entSchema.CapabilityVariableValues, entSchema.CapabilityLogs, entSchema.CapabilityWebhookURLs},
}

// serverSet keeps one server per distinct set of offered tools. A connection
// is not offered tools the auth middleware would refuse anyway: writes for
// read only credentials, and tools needing a capability it lacks.
type serverSet struct {
	version  string
	tools    []*tool
	dispatch *dispatcher
	mu       sync.Mutex
	servers  map[string]*mcp.Server
}

func (self *serverSet) serverFor(access permissions_repo.APIKeyAccess) *mcp.Server {
	offered := make([]*tool, 0, len(self.tools))
	var key strings.Builder
	for i, t := range self.tools {
		if !t.offeredTo(access) {
			continue
		}
		offered = append(offered, t)
		key.WriteString(strconv.Itoa(i))
		key.WriteByte(',')
	}

	self.mu.Lock()
	defer self.mu.Unlock()
	if server, ok := self.servers[key.String()]; ok {
		return server
	}
	server := mcp.NewServer(&mcp.Implementation{Name: "unbind", Title: "Unbind", Version: self.version}, &mcp.ServerOptions{
		Instructions: instructions,
	})
	for _, t := range offered {
		server.AddTool(t.definition, self.dispatch.handlerFor(t))
	}
	self.servers[key.String()] = server
	return server
}
