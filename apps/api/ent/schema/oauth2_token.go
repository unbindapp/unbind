package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"github.com/unbindapp/unbind-api/ent/schema/mixin"
)

// Oauth2Token holds the schema definition for the Oauth2Token entity.
type Oauth2Token struct {
	ent.Schema
}

// Mixin of the Oauth2Token.
func (Oauth2Token) Mixin() []ent.Mixin {
	return []ent.Mixin{
		mixin.PKMixin{},
		mixin.TimeMixin{},
	}
}

// Fields of the Oauth2Token.
func (Oauth2Token) Fields() []ent.Field {
	return []ent.Field{
		field.String("access_token").Unique().Sensitive(),
		field.String("refresh_token").Unique().Sensitive(),
		field.String("client_id"),
		field.Time("expires_at"),
		field.Bool("revoked").Default(false),
		field.String("scope"),
		field.String("device_info").Optional(),
	}
}

// Edges of the Oauth2Token.
func (Oauth2Token) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("user", User.Type).
			Ref("oauth2_tokens").
			Unique().
			Required(),
	}
}

// Annotations of the Oauth2Token
func (Oauth2Token) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{
			Table: "oauth2_tokens",
		},
	}
}
