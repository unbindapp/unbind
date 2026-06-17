package models

import (
	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema"
)

// CreateServiceInput defines the input for creating a new service
type CreateServiceInput struct {
	TeamID        uuid.UUID `format:"uuid" required:"true" json:"team_id"`
	ProjectID     uuid.UUID `format:"uuid" required:"true" json:"project_id"`
	EnvironmentID uuid.UUID `format:"uuid" required:"true" json:"environment_id"`
	Name          string    `required:"true" json:"name"`
	Description   string    `json:"description,omitempty"`

	// GitHub integration
	GitHubInstallationID *int64  `json:"github_installation_id,omitempty"`
	RepositoryOwner      *string `json:"repository_owner,omitempty"`
	RepositoryName       *string `json:"repository_name,omitempty"`

	// Configuration
	Type                          schema.ServiceType    `required:"true" doc:"Type of service, e.g. 'github', 'docker-image'" json:"type"`
	Builder                       schema.ServiceBuilder `required:"true" doc:"Builder of the service - docker, nixpacks, railpack" json:"builder"`
	Hosts                         []schema.HostSpec     `json:"hosts,omitempty"`
	Ports                         []schema.PortSpec     `json:"ports,omitempty"`
	Replicas                      *int32                `minimum:"0" maximum:"10" json:"replicas,omitempty"`
	AutoDeploy                    *bool                 `json:"auto_deploy,omitempty"`
	RailpackBuilderInstallCommand *string               `json:"railpack_builder_install_command,omitempty"`
	RailpackBuilderBuildCommand   *string               `json:"railpack_builder_build_command,omitempty"`
	RunCommand                    *string               `json:"run_command,omitempty"`
	IsPublic                      *bool                 `json:"is_public,omitempty"`
	Image                         *string               `json:"image,omitempty"`
	DockerBuilderDockerfilePath   *string               `json:"docker_builder_dockerfile_path,omitempty" required:"false" doc:"Optional path to Dockerfile, if using docker builder"`
	DockerBuilderBuildContext     *string               `json:"docker_builder_build_context,omitempty" required:"false" doc:"Optional path to Dockerfile context, if using docker builder"`

	// Databases (special case)
	DatabaseType         *string                `json:"database_type,omitempty"`
	DatabaseConfig       *schema.DatabaseConfig `json:"database_config,omitempty"`
	S3BackupSourceID     *uuid.UUID             `json:"s3_backup_source_id,omitempty" format:"uuid"`
	S3BackupBucket       *string                `json:"s3_backup_bucket,omitempty"`
	BackupSchedule       *string                `json:"backup_schedule,omitempty" required:"false" doc:"Cron expression for the backup schedule, e.g. '0 0 * * *'"`
	BackupRetentionCount *int                   `json:"backup_retention,omitempty" required:"false" doc:"Number of base backups to retain, e.g. 3"`

	// PVC
	Volumes []schema.ServiceVolume `json:"volumes,omitempty" required:"false" doc:"Volumes to mount in the service"`

	// Health check
	HealthCheck *schema.HealthCheck `json:"health_check,omitempty" doc:"Health check configuration for the service"`

	// Variable mounts
	VariableMounts []*schema.VariableMount `json:"variable_mounts,omitempty" doc:"Mount variables as volumes"`

	// Init containers
	InitContainers []*schema.InitContainer `json:"init_containers,omitempty" doc:"Init containers to run before the main container"`

	// Resources
	Resources *schema.Resources `json:"resources,omitempty" doc:"Resource limits and requests for the service containers"`
}

// UpdateServiceConfigInput defines the input for updating a service configuration
type UpdateServiceInput struct {
	TeamID        uuid.UUID `format:"uuid" required:"true" json:"team_id"`
	ProjectID     uuid.UUID `format:"uuid" required:"true" json:"project_id"`
	EnvironmentID uuid.UUID `format:"uuid" required:"true" json:"environment_id"`
	ServiceID     uuid.UUID `format:"uuid" required:"true" json:"service_id"`
	Name          *string   `required:"false" json:"name"`
	Description   *string   `required:"false" json:"description"`

	// Configuration
	GitBranch                     *string                `json:"git_branch,omitempty" required:"false"`
	GitTag                        *string                `json:"git_tag,omitempty" required:"false" doc:"Tag to build from, supports glob patterns"`
	Builder                       *schema.ServiceBuilder `json:"builder,omitempty" required:"false"`
	OverwriteHosts                []schema.HostSpec      `json:"overwrite_hosts,omitempty" required:"false"`
	UpsertHosts                   []schema.HostSpec      `json:"upsert_hosts,omitempty" required:"false" doc:"Additional hosts to add, will not remove existing hosts"`
	RemoveHosts                   []schema.HostSpec      `json:"remove_hosts,omitempty" required:"false" doc:"Hosts to remove"`
	AddPorts                      []schema.PortSpec      `json:"add_ports,omitempty" required:"false" doc:"Additional ports to add, will not remove existing ports"`
	RemovePorts                   []schema.PortSpec      `json:"remove_ports,omitempty" required:"false" doc:"Ports to remove"`
	OverwritePorts                []schema.PortSpec      `json:"overwrite_ports,omitempty" required:"false"`
	Replicas                      *int32                 `json:"replicas,omitempty" required:"false"`
	AutoDeploy                    *bool                  `json:"auto_deploy,omitempty" required:"false"`
	RailpackBuilderInstallCommand *string                `json:"railpack_builder_install_command,omitempty"`
	RailpackBuilderBuildCommand   *string                `json:"railpack_builder_build_command,omitempty"`
	RunCommand                    *string                `json:"run_command,omitempty" required:"false"`
	IsPublic                      *bool                  `json:"is_public,omitempty" required:"false"`
	Image                         *string                `json:"image,omitempty" required:"false"`
	DockerBuilderDockerfilePath   *string                `json:"docker_builder_dockerfile_path,omitempty" required:"false" doc:"Optional path to Dockerfile, if using docker builder - set empty string to reset to default"`
	DockerBuilderBuildContext     *string                `json:"docker_builder_build_context,omitempty" required:"false" doc:"Optional path to Dockerfile context, if using docker builder - set empty string to reset to default"`

	// Databases
	DatabaseConfig       *schema.DatabaseConfig `json:"database_config,omitempty"`
	S3BackupSourceID     *uuid.UUID             `json:"s3_backup_source_id,omitempty" format:"uuid"`
	S3BackupBucket       *string                `json:"s3_backup_bucket,omitempty"`
	BackupSchedule       *string                `json:"backup_schedule,omitempty" required:"false" doc:"Cron expression for the backup schedule, e.g. '0 0 * * *'"`
	BackupRetentionCount *int                   `json:"backup_retention,omitempty" required:"false" doc:"Number of base backups to retain, e.g. 3"`

	// Volumes
	OverwriteVolumes []schema.ServiceVolume `json:"overwrite_volumes,omitempty" required:"false" doc:"Volumes to attach to the service"`
	AddVolumes       []schema.ServiceVolume `json:"add_volumes,omitempty" required:"false" doc:"Additional volumes to add, will not remove existing volumes"`
	RemoveVolumes    []schema.ServiceVolume `json:"remove_volumes,omitempty" required:"false" doc:"Volumes to remove from the service"`

	// Health check
	HealthCheck *schema.HealthCheck `json:"health_check,omitempty" required:"false"`

	// Variable mounts
	OverwriteVariableMounts []*schema.VariableMount `json:"overwrite_variable_mounts,omitempty" doc:"Mount variables as volumes"`
	AddVariableMounts       []*schema.VariableMount `json:"add_variable_mounts,omitempty" doc:"Additional variable mounts to add, will not remove existing mounts"`
	RemoveVariableMounts    []*schema.VariableMount `json:"remove_variable_mounts,omitempty" doc:"Variable mounts to remove"`

	// Protected variables
	ProtectedVariables *[]string `json:"protected_variables,omitempty" doc:"List of protected variables"`

	// Init containers
	InitContainers []*schema.InitContainer `json:"init_containers,omitempty" doc:"List of init containers"`

	// Resources
	Resources *schema.Resources `json:"resources,omitempty" doc:"Resource limits and requests for the service containers"`
}
