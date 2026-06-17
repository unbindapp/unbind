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
	v1 "github.com/unbindapp/unbind-operator/api/v1"
)

// Status enum
type DeploymentStatus string

const (
	DeploymentStatusBuildPending   DeploymentStatus = "build-pending"
	DeploymentStatusBuildQueued    DeploymentStatus = "build-queued"
	DeploymentStatusBuildRunning   DeploymentStatus = "build-running"
	DeploymentStatusBuildSucceeded DeploymentStatus = "build-succeeded"
	DeploymentStatusBuildCancelled DeploymentStatus = "build-cancelled"
	DeploymentStatusBuildFailed    DeploymentStatus = "build-failed"
	// * POD/Instance related
	DeploymentStatusActive      DeploymentStatus = "active"       // Running and healthy
	DeploymentStatusLaunching   DeploymentStatus = "launching"    // Waiting for resources or other conditions
	DeploymentStatusLaunchError DeploymentStatus = "launch-error" // Failed to launch due to an error
	DeploymentStatusCrashing    DeploymentStatus = "crashing"     // Pod is crashing or failing in a loop
	DeploymentStatusRemoved     DeploymentStatus = "removed"      // Deployment has been replaced by a newer one
)

var allDeploymentStatuses = []DeploymentStatus{
	DeploymentStatusBuildPending,
	DeploymentStatusBuildQueued,
	DeploymentStatusBuildRunning,
	DeploymentStatusBuildSucceeded,
	DeploymentStatusBuildCancelled,
	DeploymentStatusBuildFailed,
	DeploymentStatusActive,
	DeploymentStatusLaunching,
	DeploymentStatusLaunchError,
	DeploymentStatusCrashing,
	DeploymentStatusRemoved,
}

// Values provides list valid values for Enum.
func (DeploymentStatus) Values() (kinds []string) {
	for _, s := range allDeploymentStatuses {
		kinds = append(kinds, string(s))
	}
	return
}

// Register enum in OpenAPI specification
// https://github.com/danielgtaylor/huma/issues/621
func (u DeploymentStatus) Schema(r huma.Registry) *huma.Schema {
	if r.Map()["DeploymentStatus"] == nil {
		schemaRef := r.Schema(reflect.TypeOf(""), true, "DeploymentStatus")
		schemaRef.Title = "DeploymentStatus"
		for _, v := range allDeploymentStatuses {
			schemaRef.Enum = append(schemaRef.Enum, string(v))
		}
		r.Map()["DeploymentStatus"] = schemaRef
	}
	return &huma.Schema{Ref: "#/components/schemas/DeploymentStatus"}
}

// Source enum
type DeploymentSource string

const (
	DeploymentSourceManual DeploymentSource = "manual"
	DeploymentSourceGit    DeploymentSource = "git"
)

var allDeploymentSources = []DeploymentSource{
	DeploymentSourceManual,
	DeploymentSourceGit,
}

// Values provides list valid values for Enum.
func (DeploymentSource) Values() (kinds []string) {
	for _, s := range allDeploymentSources {
		kinds = append(kinds, string(s))
	}
	return
}

// Register enum in OpenAPI specification
// https://github.com/danielgtaylor/huma/issues/621
func (u DeploymentSource) Schema(r huma.Registry) *huma.Schema {
	if r.Map()["DeploymentSource"] == nil {
		schemaRef := r.Schema(reflect.TypeOf(""), true, "DeploymentSource")
		schemaRef.Title = "DeploymentSource"
		for _, v := range allDeploymentSources {
			schemaRef.Enum = append(schemaRef.Enum, string(v))
		}
		r.Map()["DeploymentSource"] = schemaRef
	}
	return &huma.Schema{Ref: "#/components/schemas/DeploymentSource"}
}

// Type to keep track of git committer
type GitCommitter struct {
	Name      string `json:"name"`
	AvatarURL string `json:"avatar_url"`
}

// Deployment holds the schema definition for the Deployment entity.
type Deployment struct {
	ent.Schema
}

// Mixin of the Deployment.
func (Deployment) Mixin() []ent.Mixin {
	return []ent.Mixin{
		mixin.PKMixin{},
		mixin.TimeMixin{},
	}
}

// Fields of the Deployment.
func (Deployment) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("service_id", uuid.UUID{}),
		field.Enum("status").GoType(DeploymentStatus("")),
		// ! TODO - remove default
		field.Enum("source").GoType(DeploymentSource("")).Default(string(DeploymentSourceManual)),
		field.String("error").
			Optional(),
		field.String("commit_sha").
			Optional().
			Nillable(),
		field.String("commit_message").
			Optional().
			Nillable(),
		field.String("git_branch").
			Optional().
			Nillable().
			Comment("The git branch used for the deployment, if applicable"),
		field.JSON("commit_author", &GitCommitter{}).
			Optional(),
		field.Time("queued_at").
			Optional().
			Nillable(),
		field.Time("started_at").
			Optional().
			Nillable(),
		field.Time("completed_at").
			Optional().
			Nillable(),
		field.String("kubernetes_job_name").
			Optional().
			Comment("The name of the kubernetes job"),
		field.String("kubernetes_job_status").
			Optional().
			Comment("The status of the kubernetes job"),
		field.Int("attempts").
			Default(0),
		field.String("image").
			Optional().
			Nillable().
			Comment("Reference to the image used for the deployment"),
		field.JSON("resource_definition", &v1.Service{}).
			Optional().
			Comment("The Kubernetes resource definition for the deployment"),
		// Build-related fields to preserve for redeployment
		field.Enum("builder").GoType(ServiceBuilder("")).
			Comment("Builder used for this deployment"),
		field.String("railpack_builder_install_command").
			Optional().
			Nillable().
			Comment("Custom install command used for this deployment (railpack only)"),
		field.String("railpack_builder_build_command").
			Optional().
			Nillable().
			Comment("Custom build command used for this deployment (railpack only)"),
		field.String("run_command").
			Optional().
			Nillable().
			Comment("Custom run command used for this deployment"),
		field.String("docker_builder_dockerfile_path").
			Optional().
			Nillable().
			Comment("Path to Dockerfile used for this deployment (docker builder only)"),
		field.String("docker_builder_build_context").
			Optional().
			Nillable().
			Comment("Build context path used for this deployment (docker builder only)"),
	}
}

// Edges of the Deployment.
func (Deployment) Edges() []ent.Edge {
	return []ent.Edge{
		// M2O edge to keep track of the service
		edge.From("service", Service.Type).Ref("deployments").Field("service_id").Unique().Required(),
	}
}

// Indexes of the Deployment.
func (Deployment) Indexes() []ent.Index {
	return []ent.Index{
		// Single field indexes
		index.Fields("service_id"),
		index.Fields("created_at"),
		// Composite indexes
		index.Fields("service_id", "created_at"),
		index.Fields("service_id", "status", "created_at"),
	}
}

// Annotations of the Deployment
func (Deployment) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{
			Table: "deployments",
		},
	}
}
