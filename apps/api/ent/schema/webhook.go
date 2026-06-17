package schema

import (
	"fmt"
	"net/url"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema/mixin"
)

// Webhook holds the schema definition for the Webhook entity.
type Webhook struct {
	ent.Schema
}

// Mixin of the Webhook.
func (Webhook) Mixin() []ent.Mixin {
	return []ent.Mixin{
		mixin.PKMixin{},
		mixin.TimeMixin{},
	}
}

// Fields of the Webhook.
func (Webhook) Fields() []ent.Field {
	return []ent.Field{
		field.String("url").Validate(func(s string) error {
			parsed, err := url.Parse(s)
			if err != nil {
				return fmt.Errorf("invalid URL: %w", err)
			}
			if parsed.Scheme == "" || parsed.Host == "" {
				return fmt.Errorf("invalid URL: %s", s)
			}
			return nil
		}),
		field.Enum("type").GoType(WebhookType("")),
		field.JSON("events", []WebhookEvent{}),
		field.UUID("team_id", uuid.UUID{}),
		field.UUID("project_id", uuid.UUID{}).Optional().Nillable(),
	}
}

// Edges of the Webhook.
func (Webhook) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("team", Team.Type).Ref("team_webhooks").Field("team_id").Unique().Required(),
		edge.From("project", Project.Type).Ref("project_webhooks").Field("project_id").Unique(),
	}
}

// Annotations of the Webhook
func (Webhook) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{
			Table: "webhooks",
		},
	}
}
