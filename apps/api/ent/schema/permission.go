package schema

import (
	"reflect"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema/mixin"
)

// Permission holds the schema definition for the Permission entity.
type Permission struct {
	ent.Schema
}

// Mixin of the Permission.
func (Permission) Mixin() []ent.Mixin {
	return []ent.Mixin{
		mixin.PKMixin{},
		mixin.TimeMixin{},
	}
}

// Fields of the Permission.
func (Permission) Fields() []ent.Field {
	return []ent.Field{
		field.Enum("action").GoType(PermittedAction("")).Comment("Action that can be performed"),
		field.Enum("resource_type").GoType(ResourceType("")).Comment("Type of resource: 'teams', 'projects', etc."),
		field.JSON("resource_selector", ResourceSelector{}).Comment("Resource selector for this permission"),
	}
}

// Edges of the Permission.
func (Permission) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("groups", Group.Type).Ref("permissions"),
	}
}

// Annotations of the Permission
func (Permission) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{
			Table: "permissions",
		},
	}
}

// * Types
type ResourceSelector struct {
	Superuser bool      `json:"superuser" doc:"Access to every resource of this type"`
	ID        uuid.UUID `json:"id" doc:"Specific resource ID"`
}

// * Enums
// * PermittedAction enum
type PermittedAction string

const (
	// Admin can perform any action (create, read, update, delete)
	ActionAdmin PermittedAction = "admin"
	// Editor can perform read and update actions
	ActionEditor PermittedAction = "edit"
	// Viewer can only perform read actions
	ActionViewer PermittedAction = "view"
)

var allPermittedActions = []PermittedAction{
	ActionAdmin,
	ActionEditor,
	ActionViewer,
}

// Values provides list valid values for Enum.
func (s PermittedAction) Values() (kinds []string) {
	for _, s := range allPermittedActions {
		kinds = append(kinds, string(s))
	}
	return
}

// Register enum in OpenAPI specification
// https://github.com/danielgtaylor/huma/issues/621
func (u PermittedAction) Schema(r huma.Registry) *huma.Schema {
	if r.Map()["PermittedAction"] == nil {
		schemaRef := r.Schema(reflect.TypeOf(""), true, "PermittedAction")
		schemaRef.Title = "PermittedAction"
		for _, v := range allPermittedActions {
			schemaRef.Enum = append(schemaRef.Enum, string(v))
		}
		r.Map()["PermittedAction"] = schemaRef
	}
	return &huma.Schema{Ref: "#/components/schemas/PermittedAction"}
}

// * ResourceType enum
type ResourceType string

const (
	ResourceTypeSystem      ResourceType = "system" // Internal resources separate from kubernetes
	ResourceTypeTeam        ResourceType = "team"
	ResourceTypeProject     ResourceType = "project"
	ResourceTypeEnvironment ResourceType = "environment"
	ResourceTypeService     ResourceType = "service"
)

var allResourceTypes = []ResourceType{
	ResourceTypeSystem,
	ResourceTypeTeam,
	ResourceTypeProject,
	ResourceTypeEnvironment,
	ResourceTypeService,
}

// Values provides list valid values for Enum.
func (s ResourceType) Values() (kinds []string) {
	for _, s := range allResourceTypes {
		kinds = append(kinds, string(s))
	}
	return
}

// Register enum in OpenAPI specification
// https://github.com/danielgtaylor/huma/issues/621
func (u ResourceType) Schema(r huma.Registry) *huma.Schema {
	if r.Map()["PermittedAction"] == nil {
		schemaRef := r.Schema(reflect.TypeOf(""), true, "ResourceType")
		schemaRef.Title = "ResourceType"
		for _, v := range allResourceTypes {
			schemaRef.Enum = append(schemaRef.Enum, string(v))
		}
		r.Map()["ResourceType"] = schemaRef
	}
	return &huma.Schema{Ref: "#/components/schemas/ResourceType"}
}
