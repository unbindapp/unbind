package schema

import (
	"reflect"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema/mixin"
)

// Type enum
type ServiceType string

const (
	ServiceTypeGithub      ServiceType = "github"
	ServiceTypeDockerimage ServiceType = "docker-image"
	ServiceTypeDatabase    ServiceType = "database"
)

var allServiceTypes = []ServiceType{
	ServiceTypeGithub,
	ServiceTypeDockerimage,
	ServiceTypeDatabase,
}

// Values provides list valid values for Enum.
func (s ServiceType) Values() (kinds []string) {
	for _, s := range allServiceTypes {
		kinds = append(kinds, string(s))
	}
	return
}

// Register enum in OpenAPI specification
// https://github.com/danielgtaylor/huma/issues/621
func (u ServiceType) Schema(r huma.Registry) *huma.Schema {
	if r.Map()["ServiceType"] == nil {
		schemaRef := r.Schema(reflect.TypeOf(""), true, "ServiceType")
		schemaRef.Title = "ServiceType"
		for _, v := range allServiceTypes {
			schemaRef.Enum = append(schemaRef.Enum, string(v))
		}
		r.Map()["ServiceType"] = schemaRef
	}
	return &huma.Schema{Ref: "#/components/schemas/ServiceType"}
}

// Service holds the schema definition for the Service entity.
type Service struct {
	ent.Schema
}

// Mixin of the Service.
func (Service) Mixin() []ent.Mixin {
	return []ent.Mixin{
		mixin.PKMixin{},
		mixin.TimeMixin{},
	}
}

// Fields of the Service.
func (Service) Fields() []ent.Field {
	return []ent.Field{
		field.Enum("type").GoType(ServiceType("")).Comment("Type of service"),
		field.String("kubernetes_name").NotEmpty().Unique(),
		field.String("name"),
		field.String("description").Optional(),
		field.UUID("environment_id", uuid.UUID{}),
		field.JSON("detected_ports", []PortSpec{}).Optional(),
		// Database
		field.String("database").Optional().Nillable().Comment("Database to use for the service"),
		field.String("database_version").Optional().Nillable().Comment("Version of the database"),
		// Github
		field.Int64("github_installation_id").Optional().Nillable().Comment("Optional reference to GitHub installation"),
		// Git (common)
		field.String("git_repository_owner").Optional().Nillable().Comment("Git repository owner"),
		field.String("git_repository").Optional().Nillable().Comment("Git repository name"),
		field.String("kubernetes_secret").Comment("Kubernetes secret for this service"),
		field.UUID("current_deployment_id", uuid.UUID{}).Optional().Nillable().Comment("Reference the current active deployment"),
		field.UUID("template_id", uuid.UUID{}).Optional().Nillable().Comment("Reference to the template this service was created from"),
		field.UUID("template_instance_id", uuid.UUID{}).Optional().Nillable().Comment("Group reference of all services launched together from a template."),
		field.UUID("service_group_id", uuid.UUID{}).Optional().Nillable().Comment("The group this service belongs to"),
	}
}

// Edges of the Service.
func (Service) Edges() []ent.Edge {
	return []ent.Edge{
		// M2O edge to keep track of the environment
		edge.From("environment", Environment.Type).Ref("services").Field("environment_id").Unique().Required(),
		// M2O edge to keep track of the GitHub installation
		edge.From("github_installation", GithubInstallation.Type).Ref("services").Field("github_installation_id").Unique(),
		// O2O edge to keep track of the service configuration
		edge.To("service_config", ServiceConfig.Type).Unique().Annotations(
			entsql.Annotation{OnDelete: entsql.Cascade},
		),
		// O2M edge to keep track of deployments
		edge.To("deployments", Deployment.Type).Annotations(
			entsql.Annotation{OnDelete: entsql.Cascade},
		),
		// O2O edge to keep track of the current deployment
		edge.To("current_deployment", Deployment.Type).Field("current_deployment_id").Unique().
			Comment("Optional reference to the currently active deployment").
			StorageKey(edge.Column("current_deployment_id")).
			Annotations(
				entsql.Annotation{
					OnDelete: entsql.SetNull,
				},
			),
		// M2O with templates
		edge.From("template", Template.Type).Ref("services").Field("template_id").Unique(),
		// M2O with service groups
		edge.From("service_group", ServiceGroup.Type).Ref("services").Field("service_group_id").Unique(),
		// O2M with variabel references
		edge.To("variable_references", VariableReference.Type).Annotations(
			entsql.Annotation{
				OnDelete: entsql.Cascade,
			},
		),
	}
}

// Indexes of the Service.
func (Service) Indexes() []ent.Index {
	return []ent.Index{
		// Composite indexe
		index.Fields("environment_id", "created_at"),
		index.Fields("service_group_id", "created_at"),

		// Index for ordering services by created_at (most common sort)
		index.Fields("created_at"),
	}
}

// Annotations of the Service
func (Service) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{
			Table: "services",
		},
	}
}
