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

// OAuthGrantToken is an opaque access or refresh token, stored hashed. A refresh
// token with used_at set has been rotated; presenting it again is reuse.
type OAuthGrantToken struct {
	ent.Schema
}

func (OAuthGrantToken) Mixin() []ent.Mixin {
	return []ent.Mixin{
		mixin.PKMixin{},
		mixin.TimeMixin{},
	}
}

func (OAuthGrantToken) Fields() []ent.Field {
	return []ent.Field{
		field.Enum("kind").GoType(OAuthTokenKind("")),
		field.String("token_hash").Unique().Sensitive(),
		field.Time("expires_at"),
		field.Time("used_at").Optional().Nillable(),
		field.UUID("grant_id", uuid.UUID{}),
	}
}

func (OAuthGrantToken) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("grant", OAuthGrant.Type).Ref("tokens").Field("grant_id").Unique().Required(),
	}
}

func (OAuthGrantToken) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("grant_id"),
		index.Fields("expires_at"),
	}
}

func (OAuthGrantToken) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{Table: "oauth_grant_tokens"},
	}
}
