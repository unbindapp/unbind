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

// Project holds the schema definition for the Project entity.
type Project struct {
	ent.Schema
}

// Mixin of the Project.
func (Project) Mixin() []ent.Mixin {
	return []ent.Mixin{
		mixin.PKMixin{},
		mixin.TimeMixin{},
	}
}

// Fields of the Project.
func (Project) Fields() []ent.Field {
	return []ent.Field{
		field.String("kubernetes_name").NotEmpty().Unique(),
		field.String("name"),
		field.String("description").Optional().Nillable(),
		field.String("status").Default("active"),
		field.UUID("team_id", uuid.UUID{}),
		field.Strings("tags").Optional(),
		field.UUID("default_environment_id", uuid.UUID{}).Optional().Nillable(),
		field.String("kubernetes_secret").Comment("Kubernetes secret for this project"),
	}
}

// Edges of the Project.
func (Project) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("team", Team.Type).Ref("projects").Field("team_id").Unique().Required(),
		edge.To("environments", Environment.Type).Annotations(
			entsql.Annotation{
				OnDelete: entsql.Cascade,
			},
		),
		// O2O
		edge.From("default_environment", Environment.Type).
			Ref("project_default").
			Field("default_environment_id").
			Unique(),
		// O2M edge for webhooks
		edge.To("project_webhooks", Webhook.Type).Annotations(
			entsql.Annotation{OnDelete: entsql.Cascade},
		),
	}
}

// Annotations of the Project
func (Project) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{
			Table: "projects",
		},
	}
}
