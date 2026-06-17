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

// GithubApp holds the schema definition for the GithubApp entity.
type GithubApp struct {
	ent.Schema
}

// Mixin of the GithubApp.
func (GithubApp) Mixin() []ent.Mixin {
	return []ent.Mixin{
		mixin.TimeMixin{},
	}
}

// Fields of the GithubApp.
func (GithubApp) Fields() []ent.Field {
	return []ent.Field{
		field.Int64("id").
			Immutable().
			Positive().
			Unique().
			Comment("The GitHub App ID"),
		field.UUID("uuid", uuid.UUID{}).
			Immutable().
			Unique(),
		field.UUID("created_by", uuid.UUID{}).
			Comment("The user that created this github app."),
		field.String("name").
			NotEmpty().
			Comment("Name of the GitHub App"),
		field.String("client_id").
			Comment("OAuth client ID of the GitHub App"),
		field.String("client_secret").
			Sensitive().
			Comment("OAuth client secret of the GitHub App"),
		field.String("webhook_secret").
			Sensitive().
			Comment("Webhook secret for GitHub events"),
		field.Text("private_key").
			Sensitive().
			Comment("Private key (PEM) for GitHub App authentication"),
	}
}

// Edges of the GithubApp.
func (GithubApp) Edges() []ent.Edge {
	return []ent.Edge{
		// O2M with github_installations
		edge.To("installations", GithubInstallation.Type).
			Annotations(entsql.Annotation{
				OnDelete: entsql.Cascade,
			}),
		// M2O with users
		edge.From("users", User.Type).
			Ref("created_by").
			Field("created_by").
			Required().
			Unique(),
	}
}

// Annotations of the GithubApp
func (GithubApp) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{
			Table: "github_apps",
		},
	}
}
