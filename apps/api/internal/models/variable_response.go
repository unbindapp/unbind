package models

import (
	"reflect"
	"sort"

	"github.com/danielgtaylor/huma/v2"
	"github.com/unbindapp/unbind-api/ent/schema"
)

type VariableUpdateBehavior string

const (
	VariableUpdateBehaviorUpsert    VariableUpdateBehavior = "upsert"
	VariableUpdateBehaviorOverwrite VariableUpdateBehavior = "overwrite"
)

// Register enum in OpenAPI specification
// https://github.com/danielgtaylor/huma/issues/621
func (u VariableUpdateBehavior) Schema(r huma.Registry) *huma.Schema {
	if r.Map()["VariableUpdateBehavior"] == nil {
		schemaRef := r.Schema(reflect.TypeOf(""), true, "VariableUpdateBehavior")
		schemaRef.Title = "VariableUpdateBehavior"
		schemaRef.Enum = append(schemaRef.Enum, string(VariableUpdateBehaviorUpsert))
		schemaRef.Enum = append(schemaRef.Enum, string(VariableUpdateBehaviorOverwrite))
		r.Map()["VariableUpdateBehavior"] = schemaRef
	}
	return &huma.Schema{Ref: "#/components/schemas/VariableUpdateBehavior"}
}

type VariableResponse struct {
	VariableReferences []*VariableReferenceResponse `json:"variable_references" nullable:"false"`
	Variables          []*VariableResponseItem      `json:"variables" nullable:"false"`
}

type VariableResponseItem struct {
	Type  schema.VariableReferenceSourceType `json:"type"`
	Name  string                             `json:"name"`
	Value string                             `json:"value"`
}

type VariableDeleteInput struct {
	Name string `json:"name" required:"true"`
}

// Sort by type then name
func SortVariableResponse(vars []*VariableResponseItem) {
	sort.Slice(vars, func(i, j int) bool {
		if vars[i].Type != vars[j].Type {
			return vars[i].Type < vars[j].Type
		}
		return vars[i].Name < vars[j].Name
	})
}
