package schema

import (
	"reflect"

	"github.com/danielgtaylor/huma/v2"
)

type VariableReferenceType string

const (
	VariableReferenceTypeVariable VariableReferenceType = "variable"
	// Reachable from the internet
	VariableReferenceTypePublicEndpoint VariableReferenceType = "public_endpoint"
	// Reachable from inside the cluster
	VariableReferenceTypePrivateEndpoint VariableReferenceType = "private_endpoint"
)

// Values provides list valid values for Enum.
func (s VariableReferenceType) Values() (kinds []string) {
	kinds = append(kinds, []string{
		string(VariableReferenceTypeVariable),
		string(VariableReferenceTypePublicEndpoint),
		string(VariableReferenceTypePrivateEndpoint),
	}...)
	return
}

// Register enum in OpenAPI specification
// https://github.com/danielgtaylor/huma/issues/621
func (u VariableReferenceType) Schema(r huma.Registry) *huma.Schema {
	if r.Map()["VariableReferenceType"] == nil {
		schemaRef := r.Schema(reflect.TypeOf(""), true, "VariableReferenceType")
		schemaRef.Title = "VariableReferenceType"
		schemaRef.Enum = append(schemaRef.Enum, []any{
			string(VariableReferenceTypeVariable),
			string(VariableReferenceTypePublicEndpoint),
			string(VariableReferenceTypePrivateEndpoint),
		}...)
		r.Map()["VariableReferenceType"] = schemaRef
	}
	return &huma.Schema{Ref: "#/components/schemas/VariableReferenceType"}
}

// Source of the VariableReference
type VariableReferenceSourceType string

const (
	VariableReferenceSourceTypeTeam        VariableReferenceSourceType = "team"
	VariableReferenceSourceTypeProject     VariableReferenceSourceType = "project"
	VariableReferenceSourceTypeEnvironment VariableReferenceSourceType = "environment"
	VariableReferenceSourceTypeService     VariableReferenceSourceType = "service"
)

func (s VariableReferenceSourceType) KubernetesLabel() string {
	switch s {
	case VariableReferenceSourceTypeTeam:
		return "unbind-team"
	case VariableReferenceSourceTypeProject:
		return "unbind-project"
	case VariableReferenceSourceTypeEnvironment:
		return "unbind-environment"
	case VariableReferenceSourceTypeService:
		return "unbind-service"
	default:
		return ""
	}
}

// Values provides list valid values for Enum.
func (s VariableReferenceSourceType) Values() (kinds []string) {
	kinds = append(kinds, []string{
		string(VariableReferenceSourceTypeTeam),
		string(VariableReferenceSourceTypeProject),
		string(VariableReferenceSourceTypeEnvironment),
		string(VariableReferenceSourceTypeService),
	}...)
	return
}

// Register enum in OpenAPI specification
// https://github.com/danielgtaylor/huma/issues/621
func (u VariableReferenceSourceType) Schema(r huma.Registry) *huma.Schema {
	if r.Map()["VariableReferenceSourceType"] == nil {
		schemaRef := r.Schema(reflect.TypeOf(""), true, "VariableReferenceSourceType")
		schemaRef.Title = "VariableReferenceSourceType"
		schemaRef.Enum = append(schemaRef.Enum, []any{
			string(VariableReferenceSourceTypeTeam),
			string(VariableReferenceSourceTypeProject),
			string(VariableReferenceSourceTypeEnvironment),
			string(VariableReferenceSourceTypeService),
		}...)
		r.Map()["VariableReferenceSourceType"] = schemaRef
	}
	return &huma.Schema{Ref: "#/components/schemas/VariableReferenceSourceType"}
}
