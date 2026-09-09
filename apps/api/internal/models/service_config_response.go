package models

import (
	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
)

// ServiceConfigResponse defines the configuration response for a service
type ServiceConfigResponse struct {
	GitBranch                     *string               `json:"git_branch,omitempty"`
	GitTag                        *string               `json:"git_tag,omitempty"`
	WatchPaths                    []string              `json:"watch_paths" nullable:"false"`
	Builder                       schema.ServiceBuilder `json:"builder"`
	Icon                          string                `json:"icon"`
	Hosts                         []schema.HostSpec     `json:"hosts" nullable:"false"`
	Ports                         []schema.PortSpec     `json:"ports" nullable:"false"`
	Replicas                      int32                 `json:"replicas"`
	AutoDeploy                    bool                  `json:"auto_deploy"`
	RailpackBuilderInstallCommand *string               `json:"railpack_builder_install_command,omitempty"`
	RailpackBuilderBuildCommand   *string               `json:"railpack_builder_build_command,omitempty"`
	RunCommand                    *string               `json:"run_command,omitempty"`
	IsPublic                      bool                  `json:"is_public"`
	Image                         string                `json:"image,omitempty"`
	// Dockerfile build overrides
	DockerBuilderDockerfilePath *string `json:"docker_builder_dockerfile_path,omitempty"`
	DockerBuilderBuildContext   *string `json:"docker_builder_build_context,omitempty"`
	// For backups
	S3BackupBucketID     *uuid.UUID `json:"s3_backup_bucket_id,omitempty" format:"uuid"`
	BackupSchedule       string     `json:"backup_schedule"`
	BackupRetentionCount int        `json:"backup_retention_count"`
	// Volume
	Volumes []*PVCInfo `json:"volumes" nullable:"false"`
	// Security context
	SecurityContext *schema.SecurityContext `json:"security_context,omitempty"`
	// Health check
	HealthCheck *schema.HealthCheck `json:"health_check,omitempty"`
	// Variable Volume Mounts
	VariableMounts []*schema.VariableMount `json:"variable_mounts" nullable:"false"`
	// Protected variables
	ProtectedVariables []string `json:"protected_variables" nullable:"false"`
	// Init containers
	InitContainers []*schema.InitContainer `json:"init_containers" nullable:"false"`
	// Resources
	Resources *schema.Resources `json:"resources,omitempty"`
	// Database
	DatabaseConfig *DatabaseConfigResponse `json:"database_config,omitempty"`
}

// The init script stays out, templates substitute generated passwords into it
type DatabaseConfigResponse struct {
	Version              string          `json:"version,omitempty"`
	StorageSize          string          `json:"storage,omitempty"`
	DefaultDatabaseName  string          `json:"default_database_name,omitempty"`
	WalLevel             schema.WalLevel `json:"wal_level,omitempty"`
	MaxReplicationSlots  int             `json:"max_replication_slots"`
	MaxWalSenders        int             `json:"max_wal_senders"`
	MaxSlotWalKeepSizeMB int             `json:"max_slot_wal_keep_size_mb"`
}

func transformDatabaseConfig(config *schema.DatabaseConfig) *DatabaseConfigResponse {
	if config == nil {
		return nil
	}
	return &DatabaseConfigResponse{
		Version:              config.Version,
		StorageSize:          config.StorageSize,
		DefaultDatabaseName:  config.DefaultDatabaseName,
		WalLevel:             config.WalLevel,
		MaxReplicationSlots:  intOrZero(config.MaxReplicationSlots),
		MaxWalSenders:        intOrZero(config.MaxWalSenders),
		MaxSlotWalKeepSizeMB: intOrZero(config.MaxSlotWalKeepSizeMB),
	}
}

func intOrZero(value *int) int {
	if value == nil {
		return 0
	}
	return *value
}

// TransformServiceConfigEntity transforms an ent.ServiceConfig entity into a ServiceConfigResponse
func TransformServiceConfigEntity(entity *ent.ServiceConfig) *ServiceConfigResponse {
	response := &ServiceConfigResponse{}
	if entity != nil {
		response = &ServiceConfigResponse{
			GitBranch:                     entity.GitBranch,
			GitTag:                        entity.GitTag,
			WatchPaths:                    entity.WatchPaths,
			Builder:                       entity.Builder,
			Icon:                          entity.Icon,
			Hosts:                         entity.Hosts,
			Ports:                         entity.Ports,
			Replicas:                      entity.Replicas,
			AutoDeploy:                    entity.AutoDeploy,
			RailpackBuilderInstallCommand: entity.RailpackBuilderInstallCommand,
			RailpackBuilderBuildCommand:   entity.RailpackBuilderBuildCommand,
			RunCommand:                    entity.RunCommand,
			IsPublic:                      entity.IsPublic,
			Image:                         entity.Image,
			S3BackupBucketID:              entity.S3BackupBucketID,
			BackupSchedule:                entity.BackupSchedule,
			BackupRetentionCount:          entity.BackupRetentionCount,
			SecurityContext:               entity.SecurityContext,
			HealthCheck:                   entity.HealthCheck,
			VariableMounts:                entity.VariableMounts,
			ProtectedVariables:            entity.ProtectedVariables,
			InitContainers:                entity.InitContainers,
			Volumes:                       []*PVCInfo{},
			Resources:                     entity.Resources,
			DockerBuilderDockerfilePath:   entity.DockerBuilderDockerfilePath,
			DockerBuilderBuildContext:     entity.DockerBuilderBuildContext,
			DatabaseConfig:                transformDatabaseConfig(entity.DatabaseConfig),
		}
		if response.WatchPaths == nil {
			response.WatchPaths = []string{}
		}
		if response.ProtectedVariables == nil {
			response.ProtectedVariables = []string{}
		}
		if response.VariableMounts == nil {
			response.VariableMounts = []*schema.VariableMount{}
		}
		if response.InitContainers == nil {
			response.InitContainers = []*schema.InitContainer{}
		}
		if response.Hosts == nil {
			response.Hosts = []schema.HostSpec{}
		}
		if response.Ports == nil {
			response.Ports = []schema.PortSpec{}
		}
	}
	return response
}
