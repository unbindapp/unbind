package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"github.com/unbindapp/unbind-api/ent/schema/mixin"
)

type GithubInstallationPermissions struct {
	Contents string `json:"contents,omitempty"`
	Metadata string `json:"metadata,omitempty"`
}

// GithubInstallation holds the schema definition for the GithubInstallation entity.
type GithubInstallation struct {
	ent.Schema
}

// Mixin of the GithubInstallation.
func (GithubInstallation) Mixin() []ent.Mixin {
	return []ent.Mixin{
		mixin.TimeMixin{},
	}
}

// Fields of the GithubInstallation.
func (GithubInstallation) Fields() []ent.Field {
	return []ent.Field{
		field.Int64("id").
			Immutable().
			Positive().
			Unique().
			Comment("The GitHub Installation ID"),
		field.Int64("github_app_id").
			Comment("The GitHub App ID this installation belongs to"),
		// Account fields (common to both orgs and users)
		field.Int64("account_id").
			Comment("The GitHub account ID (org or user)"),
		field.String("account_login").
			NotEmpty().
			Comment("The GitHub account login (org or user name)"),
		field.Enum("account_type").
			Values("Organization", "User").
			Comment("Type of GitHub account"),
		field.String("account_url").
			NotEmpty().
			Comment("The HTML URL to the GitHub account"),
		// Repository access
		field.Enum("repository_selection").
			Values("all", "selected").
			Default("all").
			Comment("Whether the installation has access to all repos or only selected ones"),
		// Status fields
		field.Bool("suspended").
			Default(false).
			Comment("Whether the installation is suspended"),
		field.Bool("active").
			Default(true).
			Comment("Whether the installation is active"),
		// Permissions and settings - optional but useful
		field.JSON("permissions", GithubInstallationPermissions{}).
			Optional().
			Comment("Permissions granted to this installation"),
		field.JSON("events", []string{}).
			Optional().
			Comment("Events this installation subscribes to"),
	}
}

// Edges of the GithubInstallation.
func (GithubInstallation) Edges() []ent.Edge {
	return []ent.Edge{
		// M2O with github_apps
		edge.From("github_app", GithubApp.Type).
			Ref("installations").
			Field("github_app_id").
			Required().
			Unique(),
		// O2M with services
		edge.To("services", Service.Type),
	}
}

// Indexes of the GithubInstallation.
func (GithubInstallation) Indexes() []ent.Index {
	return nil
}

// Annotations of the GithubInstallation
func (GithubInstallation) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{
			Table: "github_installations",
		},
	}
}
