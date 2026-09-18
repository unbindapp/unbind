package mcpserver

import (
	"encoding/json"
	"testing"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humachi"
	"github.com/go-chi/chi/v5"
	"github.com/google/jsonschema-go/jsonschema"
	"github.com/unbindapp/unbind-api/config"
	"github.com/unbindapp/unbind-api/internal/api/middleware"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/router"
	"github.com/unbindapp/unbind-api/internal/api/server"
)

func realAPI() huma.API {
	cfg := &config.Config{}
	api := humachi.New(chi.NewRouter(), router.NewHumaConfig("Unbind API", "test", cfg.CookieSecure))
	router.RegisterRoutes(api, &server.Server{}, middleware.NewMiddleware(cfg, nil, api, nil, nil), nil)
	return api
}

// A new endpoint fails here until it is registered with oapi.MCP or
// oapi.NoMCP, which is what keeps the MCP server in step with the API.
func TestEveryOperationDecidesOnMCP(t *testing.T) {
	for _, op := range Operations(realAPI()) {
		choice, decided := oapi.MCPChoiceOf(op)
		unreachable := len(op.Security) == 0 || oapi.IsSessionOnly(op)

		if unreachable && choice.Exposed {
			t.Errorf("%s is public or session only, it cannot be registered with oapi.MCP", op.OperationID)
		}
		if unreachable {
			continue
		}
		if !decided {
			t.Errorf("%s must be registered with oapi.MCP or oapi.NoMCP(reason)", op.OperationID)
			continue
		}
		if !choice.Exposed && choice.Reason == "" {
			t.Errorf("%s opts out of MCP without a reason", op.OperationID)
		}
	}
}

func TestRealOperationsBuildValidTools(t *testing.T) {
	tools, err := buildTools(realAPI())
	if err != nil {
		t.Fatal(err)
	}
	if len(tools) == 0 {
		t.Fatal("no operation is registered with oapi.MCP")
	}

	for _, tool := range tools {
		raw, err := json.Marshal(tool.definition.InputSchema)
		if err != nil {
			t.Fatalf("%s: %v", tool.definition.Name, err)
		}
		var schema jsonschema.Schema
		if err := json.Unmarshal(raw, &schema); err != nil {
			t.Fatalf("%s: input schema is not valid JSON Schema: %v", tool.definition.Name, err)
		}
		if _, err := schema.Resolve(nil); err != nil {
			t.Errorf("%s: input schema does not resolve: %v", tool.definition.Name, err)
		}
		if tool.definition.Description == "" {
			t.Errorf("%s: a tool needs a description", tool.definition.Name)
		}
	}
}
