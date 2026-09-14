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

type APIKey struct {
	ent.Schema
}

func (APIKey) Mixin() []ent.Mixin {
	return []ent.Mixin{
		mixin.PKMixin{},
		mixin.TimeMixin{},
	}
}

func (APIKey) Fields() []ent.Field {
	return []ent.Field{
		field.String("name").NotEmpty(),
		field.String("token_prefix"),
		field.String("token_hash").Unique().Sensitive(),
		field.JSON("scopes", []APIKeyScope{}),
		field.Time("expires_at").Optional().Nillable(),
		field.Time("last_used_at").Optional().Nillable(),
		field.UUID("user_id", uuid.UUID{}),
	}
}

func (APIKey) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("user", User.Type).Ref("api_keys").Field("user_id").Unique().Required(),
	}
}

func (APIKey) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{
			Table: "api_keys",
		},
	}
}

// APIKeyScope is one grant carried by an API key. It uses the same vocabulary as
// a group permission and can never exceed what the key's owner holds.
type APIKeyScope struct {
	Action           PermittedAction  `json:"action" required:"true"`
	ResourceType     ResourceType     `json:"resource_type" required:"true"`
	ResourceSelector ResourceSelector `json:"resource_selector" required:"true"`
}
