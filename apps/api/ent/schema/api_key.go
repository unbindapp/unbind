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
		field.Enum("role").GoType(PermittedAction("")).Comment("Strongest action the key can perform anywhere"),
		field.Bool("full_access").Default(false).Comment("Reach everything the owner can, capped at role"),
		field.JSON("resources", []APIKeyResource{}).Comment("Resources the key is limited to; empty when full_access"),
		field.JSON("privileges", []KeyPrivilege{}).Default([]KeyPrivilege{}).Comment("What the credential may see beyond its role; empty by default"),
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

func (APIKey) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("user_id", "name").Unique(),
	}
}

func (APIKey) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{
			Table: "api_keys",
		},
	}
}

// APIKeyResource is one resource an API key is limited to. The key reaches the
// resource and everything below it, at the key's role, provided the owner can.
type APIKeyResource struct {
	ResourceType ResourceType `json:"resource_type" required:"true"`
	ResourceID   uuid.UUID    `json:"resource_id" required:"true" format:"uuid"`
}
