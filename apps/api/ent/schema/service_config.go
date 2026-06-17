package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema/mixin"
	"github.com/unbindapp/unbind-api/internal/sourceanalyzer/enum"
)

// ServiceConfig holds environment-specific configuration for a service
type ServiceConfig struct {
	ent.Schema
}

// Mixin of the ServiceConfig.
func (ServiceConfig) Mixin() []ent.Mixin {
	return []ent.Mixin{
		mixin.PKMixin{},
		mixin.TimeMixin{},
	}
}

// Fields of the ServiceConfig.
func (ServiceConfig) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("service_id", uuid.UUID{}),
		field.Enum("builder").GoType(ServiceBuilder("")),
		field.String("icon").Comment("Icon metadata, unique of framework, provider, database"),
		// For builds from git using Dockerfile
		field.String("docker_builder_dockerfile_path").Optional().Nillable().Comment("Path to Dockerfile if using docker builder"),
		field.String("docker_builder_build_context").Optional().Nillable().Comment("Path to Dockerfile context if using docker builder"),
		// Provider and framework directly from railpack
		field.Enum("railpack_provider").GoType(enum.Provider("")).Optional().Nillable().Comment("Provider (e.g. Go, Python, Node, Deno)"),
		field.Enum("railpack_framework").GoType(enum.Framework("")).Optional().Nillable().Comment("Framework of service - corresponds mostly to railpack results - e.g. Django, Next, Express, Gin"),
		// Branch to build from (git)
		field.String("git_branch").Optional().Nillable().Comment("Branch to build from"),
		field.String("git_tag").Optional().Nillable().Comment("Tag to build from, supports glob patterns"),
		// Generic CRD configuration
		field.JSON("hosts", []HostSpec{}).Optional().Comment("External domains and paths for the service"),
		field.JSON("ports", []PortSpec{}).Optional().Comment("Container ports to expose"),
		field.Int32("replicas").Default(1).Comment("Number of replicas for the service"),
		field.Bool("auto_deploy").Default(false).Comment("Whether to automatically deploy on git push"),
		field.String("railpack_builder_install_command").Optional().Nillable().Comment("Custom install command (railpack only)"),
		field.String("railpack_builder_build_command").Optional().Nillable().Comment("Custom build command (railpack only)"),
		field.String("run_command").Optional().Nillable().Comment("Custom run command"),
		field.Bool("is_public").Default(false).Comment("Whether the service is publicly accessible, creates an ingress resource"),
		field.String("image").Optional().Comment("Custom Docker image if not building from git"), // Only applies to type=docker-image
		// Database
		field.String("definition_version").Optional().Nillable().Comment("Version of the database custom resource definition"),
		field.JSON("database_config", &DatabaseConfig{}).Optional().Comment("Database configuration for the service"),
		field.UUID("s3_backup_source_id", uuid.UUID{}).Optional().Nillable().Comment("S3 source to backup to"),
		field.String("s3_backup_bucket").Optional().Nillable().Comment("S3 bucket to backup to"),
		field.String("backup_schedule").Default("5 5 * * *").Comment("Cron expression for the backup schedule"),
		field.Int("backup_retention_count").Default(3).Comment("Number of base backups to retain"),
		// Volume
		field.JSON("volumes", []ServiceVolume{}).Optional().Comment("Volumes to mount in the service"),
		// Security context
		field.JSON("security_context", &SecurityContext{}).Optional().Comment("Security context for the service containers."),
		// Health check
		field.JSON("health_check", &HealthCheck{}).Optional().Comment("Health check configuration for the service"),
		// Variable mount
		field.JSON("variable_mounts", []*VariableMount{}).Optional().Comment("Mount variables as volumes"),
		field.Strings("protected_variables").Optional().Comment("List of protected variables (can be edited, not deleted)"),
		// Init containers
		field.JSON("init_containers", []*InitContainer{}).Optional().Comment("Init containers to run before the main container"),
		// Resource limits/requests
		field.JSON("resources", &Resources{}).Optional().Comment("Resource limits for the service containers"),
	}
}

// Edges of the ServiceConfig.
func (ServiceConfig) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("service", Service.Type).Ref("service_config").Field("service_id").Unique().Required(),
		// O2M to backup sources
		edge.From("s3_backup_sources", S3.Type).Ref("service_backup_source").Field("s3_backup_source_id").Unique(),
	}
}

// Annotations of the ServiceConfig
func (ServiceConfig) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{
			Table: "service_configs",
		},
	}
}
