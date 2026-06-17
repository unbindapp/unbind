package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema/mixin"
)

// ServiceGroup holds the schema definition for the ServiceGroup entity.
type ServiceGroup struct {
	ent.Schema
}

// Mixin of the ServiceGroup.
func (ServiceGroup) Mixin() []ent.Mixin {
	return []ent.Mixin{
		mixin.PKMixin{},
		mixin.TimeMixin{},
	}
}

// Fields of the ServiceGroup.
func (ServiceGroup) Fields() []ent.Field {
	return []ent.Field{
		field.String("name").Comment("Name of the service group"),
		field.String("icon").Optional().Nillable(),
		field.String("description").Optional().Nillable().Comment("Description of the service group"),
		field.UUID("environment_id", uuid.UUID{}).Comment("Reference to the environment this service group belongs to"),
	}
}

// Edges of the ServiceGroup.
func (ServiceGroup) Edges() []ent.Edge {
	return []ent.Edge{
		// M2O with environment
		edge.From("environment", Environment.Type).Ref("service_groups").Field("environment_id").Unique().Required(),
		// O2M with service
		edge.To("services", Service.Type),
	}
}

// Annotations of the ServiceGroup
func (ServiceGroup) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{
			Table: "service_groups",
		},
	}
}
