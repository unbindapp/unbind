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

// Invitation is a pending offer of a role on a team to an email address. The
// token is only ever stored hashed; the link holding it goes to the invitee.
type Invitation struct {
	ent.Schema
}

func (Invitation) Mixin() []ent.Mixin {
	return []ent.Mixin{
		mixin.PKMixin{},
		mixin.TimeMixin{},
	}
}

func (Invitation) Fields() []ent.Field {
	return []ent.Field{
		field.String("email").NotEmpty(),
		field.String("token_hash").Unique().Sensitive(),
		field.Enum("role").GoType(PermittedAction("")),
		field.Time("expires_at"),
		field.Time("accepted_at").Optional().Nillable(),
		field.UUID("team_id", uuid.UUID{}),
		field.UUID("invited_by", uuid.UUID{}).Optional().Nillable(),
	}
}

func (Invitation) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("team", Team.Type).Ref("invitations").Field("team_id").Unique().Required(),
		edge.From("inviter", User.Type).Ref("sent_invitations").Field("invited_by").Unique(),
	}
}

func (Invitation) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("team_id"),
	}
}

func (Invitation) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{Table: "invitations"},
	}
}
