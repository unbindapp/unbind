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

// Group holds the schema definition for the Group entity.
type Group struct {
	ent.Schema
}

// Mixin of the Group.
func (Group) Mixin() []ent.Mixin {
	return []ent.Mixin{
		mixin.PKMixin{},
		mixin.TimeMixin{},
	}
}

// Fields of the Group.
func (Group) Fields() []ent.Field {
	return []ent.Field{
		field.String("name").NotEmpty(),
		field.String("description").Optional(),
		field.String("k8s_role_name").Optional().Nillable().Comment("Reference to the Kubernetes Role name"),
		field.UUID("team_id", uuid.UUID{}).Optional().Nillable().Comment("Set on a role group owned by a team"),
		field.Enum("role").GoType(PermittedAction("")).Optional().Nillable().Comment("The one role a team role group grants on its team"),
	}
}

// Edges of the Group.
func (Group) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("users", User.Type).Ref("groups"),
		edge.To("permissions", Permission.Type),
		edge.From("team", Team.Type).Ref("role_groups").Field("team_id").Unique(),
	}
}

// Indexes of the Group.
func (Group) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("team_id", "role").Unique(),
	}
}

// Annotations of the Group
func (Group) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{
			Table: "groups",
		},
	}
}
