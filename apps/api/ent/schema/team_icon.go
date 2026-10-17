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

// TeamIcon holds the schema definition for the TeamIcon entity.
type TeamIcon struct {
	ent.Schema
}

// Mixin of the TeamIcon.
func (TeamIcon) Mixin() []ent.Mixin {
	return []ent.Mixin{
		mixin.PKMixin{},
		mixin.TimeMixin{},
	}
}

// Fields of the TeamIcon.
func (TeamIcon) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("team_id", uuid.UUID{}),
		field.String("content_type").Comment("image/svg+xml, image/png or image/jpeg"),
		field.Bytes("data").Sensitive().Comment("The icon file, validated before it is stored"),
	}
}

// Edges of the TeamIcon.
func (TeamIcon) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("team", Team.Type).Ref("icon").Field("team_id").Unique().Required(),
	}
}

// Annotations of the TeamIcon
func (TeamIcon) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{
			Table: "team_icons",
		},
	}
}
