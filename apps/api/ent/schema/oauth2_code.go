package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"github.com/unbindapp/unbind-api/ent/schema/mixin"
)

// Oauth2Code holds the schema definition for the authorization Oauth2Code entity.
type Oauth2Code struct {
	ent.Schema
}

// Mixin of the Oauth2Code.
func (Oauth2Code) Mixin() []ent.Mixin {
	return []ent.Mixin{
		mixin.PKMixin{},   // If you want an auto-increment ID or UUID
		mixin.TimeMixin{}, // If you want created_at / updated_at fields
	}
}

// Fields of the Oauth2Code.
func (Oauth2Code) Fields() []ent.Field {
	return []ent.Field{
		// Stores the actual code string the OAuth2 flow will look up
		field.String("auth_code").
			Unique().
			Sensitive(),
		// The client ID that requested this code
		field.String("client_id"),
		// The scopes associated with this code
		field.String("scope"),
		// When this code expires
		field.Time("expires_at"),
		// Whether this code has been revoked or used (optional but helpful)
		field.Bool("revoked").
			Default(false),
	}
}

// Edges of the Oauth2Code.
func (Oauth2Code) Edges() []ent.Edge {
	return []ent.Edge{
		// A single user who received/granted this authorization code
		edge.From("user", User.Type).
			Ref("oauth2_codes").
			Unique().
			Required(),
	}
}

// Annotations of the Oauth2Code.
func (Oauth2Code) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{
			Table: "oauth2_codes",
		},
	}
}
