package mcpserver

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"

	"github.com/danielgtaylor/huma/v2"
	"github.com/modelcontextprotocol/go-sdk/mcp"
	entSchema "github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

const (
	componentRefPrefix = "#/components/schemas/"
	defsRefPrefix      = "#/$defs/"
	jsonContentType    = "application/json"
)

type tool struct {
	definition *mcp.Tool
	method     string
	path       string
	// queryParams is set for operations that take their input in the query
	// string. Operations with a JSON body take the tool arguments as that body.
	queryParams map[string]*huma.Param
	hasBody     bool
	// readOnly and capability mirror the checks the auth middleware applies
	// to credentials, so a connection is not offered tools it cannot call.
	readOnly   bool
	capability entSchema.KeyCapability
}

func (self *tool) offeredTo(access permissions_repo.APIKeyAccess) bool {
	if !self.readOnly && !access.AllowsWrites() {
		return false
	}
	if self.capability != "" && !access.Has(self.capability) {
		return false
	}
	return true
}

// Operations lists every registered operation, ordered by operation ID.
func Operations(api huma.API) []*huma.Operation {
	var ops []*huma.Operation
	for _, item := range api.OpenAPI().Paths {
		for _, op := range []*huma.Operation{item.Get, item.Post, item.Put, item.Patch, item.Delete} {
			if op != nil {
				ops = append(ops, op)
			}
		}
	}
	sort.Slice(ops, func(i, j int) bool { return ops[i].OperationID < ops[j].OperationID })
	return ops
}

func buildTools(api huma.API) ([]*tool, error) {
	registry := api.OpenAPI().Components.Schemas
	var tools []*tool
	for _, op := range Operations(api) {
		choice, _ := oapi.MCPChoiceOf(op)
		if !choice.Exposed {
			continue
		}
		if oapi.IsSessionOnly(op) {
			return nil, fmt.Errorf("mcp: %s is session only and cannot be a tool", op.OperationID)
		}
		t, err := buildTool(op, registry)
		if err != nil {
			return nil, fmt.Errorf("mcp: %s: %w", op.OperationID, err)
		}
		tools = append(tools, t)
	}
	return tools, nil
}

func buildTool(op *huma.Operation, registry huma.Registry) (*tool, error) {
	action, known := oapi.ActionOf(op)
	capability, _ := oapi.CapabilityOf(op)
	t := &tool{method: op.Method, path: op.Path, readOnly: known && action == oapi.Read, capability: capability}

	var (
		schema map[string]any
		err    error
	)
	if body := jsonBody(op); body != nil {
		if len(op.Parameters) > 0 {
			return nil, fmt.Errorf("operations with both a body and parameters are not supported")
		}
		t.hasBody = true
		schema, err = bodySchema(body, registry)
	} else {
		t.queryParams = map[string]*huma.Param{}
		schema, err = querySchema(op.Parameters, t.queryParams)
	}
	if err != nil {
		return nil, err
	}
	if err := inlineRefs(schema, registry); err != nil {
		return nil, err
	}

	t.definition = &mcp.Tool{
		Name:        op.OperationID,
		Title:       op.Summary,
		Description: op.Description,
		InputSchema: schema,
		Annotations: annotations(op),
	}
	return t, nil
}

func jsonBody(op *huma.Operation) *huma.Schema {
	if op.RequestBody == nil {
		return nil
	}
	media, ok := op.RequestBody.Content[jsonContentType]
	if !ok {
		return nil
	}
	return media.Schema
}

func bodySchema(body *huma.Schema, registry huma.Registry) (map[string]any, error) {
	if body.Ref != "" {
		body = registry.SchemaFromRef(body.Ref)
	}
	if body == nil {
		return nil, fmt.Errorf("request body schema not found")
	}
	schema, err := toMap(body)
	if err != nil {
		return nil, err
	}
	if schema["type"] != "object" {
		return nil, fmt.Errorf("request body must be an object")
	}
	return schema, nil
}

func querySchema(params []*huma.Param, byName map[string]*huma.Param) (map[string]any, error) {
	properties := map[string]any{}
	required := []string{}
	for _, param := range params {
		if param.In != "query" {
			return nil, fmt.Errorf("%s parameter %q is not supported", param.In, param.Name)
		}
		property, err := toMap(param.Schema)
		if err != nil {
			return nil, err
		}
		if _, described := property["description"]; !described && param.Description != "" {
			property["description"] = param.Description
		}
		properties[param.Name] = property
		byName[param.Name] = param
		if param.Required {
			required = append(required, param.Name)
		}
	}

	schema := map[string]any{
		"type":                 "object",
		"properties":           properties,
		"additionalProperties": false,
	}
	if len(required) > 0 {
		schema["required"] = required
	}
	return schema, nil
}

// inlineRefs makes the schema self contained: every component it reaches is
// copied under $defs and the references are pointed there.
func inlineRefs(schema map[string]any, registry huma.Registry) error {
	defs := map[string]any{}
	pending := rewriteRefs(schema)
	for len(pending) > 0 {
		name := pending[0]
		pending = pending[1:]
		if _, done := defs[name]; done {
			continue
		}
		component := registry.SchemaFromRef(componentRefPrefix + name)
		if component == nil {
			return fmt.Errorf("schema %q not found", name)
		}
		def, err := toMap(component)
		if err != nil {
			return err
		}
		defs[name] = def
		pending = append(pending, rewriteRefs(def)...)
	}
	if len(defs) > 0 {
		schema["$defs"] = defs
	}
	return nil
}

func rewriteRefs(node any) []string {
	var names []string
	switch value := node.(type) {
	case map[string]any:
		if ref, ok := value["$ref"].(string); ok && strings.HasPrefix(ref, componentRefPrefix) {
			name := strings.TrimPrefix(ref, componentRefPrefix)
			value["$ref"] = defsRefPrefix + name
			names = append(names, name)
		}
		for _, child := range value {
			names = append(names, rewriteRefs(child)...)
		}
	case []any:
		for _, child := range value {
			names = append(names, rewriteRefs(child)...)
		}
	}
	return names
}

func toMap(schema *huma.Schema) (map[string]any, error) {
	raw, err := json.Marshal(schema)
	if err != nil {
		return nil, err
	}
	var out map[string]any
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func annotations(op *huma.Operation) *mcp.ToolAnnotations {
	hints, _ := op.Extensions["x-agent"].(map[string]any)
	flag := func(name string) bool {
		v, _ := hints[name].(bool)
		return v
	}
	destructive := flag("destructiveHint")
	openWorld := flag("openWorldHint")
	return &mcp.ToolAnnotations{
		Title:           op.Summary,
		ReadOnlyHint:    flag("readOnlyHint"),
		DestructiveHint: &destructive,
		IdempotentHint:  flag("idempotentHint"),
		OpenWorldHint:   &openWorld,
	}
}
