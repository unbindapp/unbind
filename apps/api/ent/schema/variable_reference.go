package schema

import (
	"reflect"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema/mixin"
)

type VariableReferenceSource struct {
	Type                 VariableReferenceType       `json:"type"`
	SourceName           string                      `json:"source_name"`
	SourceIcon           string                      `json:"source_icon"`
	SourceType           VariableReferenceSourceType `json:"source_type"`
	SourceID             uuid.UUID                   `json:"source_id"`
	SourceKubernetesName string                      `json:"source_kubernetes_name"`
	Key                  string                      `json:"key"`
}

// VariableReference holds the schema definition for the VariableReference entity.
type VariableReference struct {
	ent.Schema
}

// Mixin of the VariableReference.
func (VariableReference) Mixin() []ent.Mixin {
	return []ent.Mixin{
		mixin.PKMixin{},
		mixin.TimeMixin{},
	}
}

// Fields of the VariableReference.
func (VariableReference) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("target_service_id", uuid.UUID{}),
		field.String("target_name"),
		field.JSON("sources", []VariableReferenceSource{}).
			Comment("List of sources for this variable reference, interpolated as ${source_kubernetes_name.key}"),
		field.String("value_template").
			Comment("Optional template for the value, e.g. 'Hello ${a.b} this is my variable ${c.d}'"),
		field.String("error").Optional().Nillable().Comment("Error message if the variable reference could not be resolved"),
	}
}

// Edges of the VariableReference.
func (VariableReference) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("service", Service.Type).
			Ref("variable_references").
			Field("target_service_id").
			Unique().
			Required().
			Comment("Service that this variable reference points to"),
	}
}

// Indexes of the VariableReference.
func (VariableReference) Indexes() []ent.Index {
	return []ent.Index{
		// Unique constraint to prevent duplicates
		index.Fields("target_service_id", "target_name").Unique(),

		// Single field
		index.Fields("target_service_id"),

		// Composite indexes
		index.Fields("target_service_id", "created_at"),

		// Index for ordering variable references
		index.Fields("created_at"),
	}
}

// Annotations of the VariableReference
func (VariableReference) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{
			Table: "variable_references",
		},
	}
}

// Enums
type VariableReferenceType string

const (
	VariableReferenceTypeVariable VariableReferenceType = "variable"
	// Kubernetes ingresses
	VariableReferenceTypeExternalEndpoint VariableReferenceType = "external_endpoint"
	// Kubedns
	VariableReferenceTypeInternalEndpoint VariableReferenceType = "internal_endpoint"
)

// Values provides list valid values for Enum.
func (s VariableReferenceType) Values() (kinds []string) {
	kinds = append(kinds, []string{
		string(VariableReferenceTypeVariable),
		string(VariableReferenceTypeExternalEndpoint),
		string(VariableReferenceTypeInternalEndpoint),
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
			string(VariableReferenceTypeExternalEndpoint),
			string(VariableReferenceTypeInternalEndpoint),
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
