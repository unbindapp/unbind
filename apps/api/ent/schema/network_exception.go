package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema/mixin"
)

// NetworkException holds the schema definition for the NetworkException entity.
type NetworkException struct {
	ent.Schema
}

// Mixin of the NetworkException.
func (NetworkException) Mixin() []ent.Mixin {
	return []ent.Mixin{
		mixin.PKMixin{},
		mixin.TimeMixin{},
	}
}

// Fields of the NetworkException.
func (NetworkException) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("source_service_id", uuid.UUID{}).Optional().Nillable().Comment("Service allowed to connect, empty allows every source"),
		field.UUID("target_service_id", uuid.UUID{}).Comment("Service that accepts the connections"),
	}
}

// Edges of the NetworkException.
func (NetworkException) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("source_service", Service.Type).Ref("outgoing_network_exceptions").Field("source_service_id").Unique(),
		edge.From("target_service", Service.Type).Ref("incoming_network_exceptions").Field("target_service_id").Unique().Required(),
	}
}

// Indexes of the NetworkException.
func (NetworkException) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("source_service_id", "target_service_id").Unique(),
	}
}

// Annotations of the NetworkException
func (NetworkException) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{
			Table: "network_exceptions",
		},
	}
}
