package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
)

type DeploymentResponse struct {
	ID                            uuid.UUID               `json:"id"`
	ServiceID                     uuid.UUID               `json:"service_id"`
	Status                        schema.DeploymentStatus `json:"status"`
	CrashingReasons               []string                `json:"crashing_reasons" nullable:"false"`
	InstanceEvents                []EventRecord           `json:"instance_events" nullable:"false"`
	InstanceRestarts              int32                   `json:"instance_restarts"`
	JobName                       string                  `json:"job_name"`
	Error                         string                  `json:"error,omitempty"`
	Attempts                      int                     `json:"attempts"`
	CommitSHA                     *string                 `json:"commit_sha,omitempty" required:"false"`
	GitBranch                     *string                 `json:"git_branch,omitempty" required:"false"`
	CommitMessage                 *string                 `json:"commit_message,omitempty" required:"false"`
	CommitAuthor                  *schema.GitCommitter    `json:"commit_author,omitempty" required:"false"`
	Image                         *string                 `json:"image,omitempty" required:"false"`
	Builder                       schema.ServiceBuilder   `json:"builder"`
	RailpackBuilderInstallCommand *string                 `json:"railpack_builder_install_command,omitempty"`
	RailpackBuilderBuildCommand   *string                 `json:"railpack_builder_build_command,omitempty"`
	RunCommand                    *string                 `json:"run_command,omitempty"`
	DockerBuilderDockerfilePath   *string                 `json:"docker_builder_dockerfile_path,omitempty"`
	DockerBuilderBuildContext     *string                 `json:"docker_builder_build_context,omitempty"`
	CreatedAt                     time.Time               `json:"created_at"`
	QueuedAt                      *time.Time              `json:"queued_at,omitempty"`
	StartedAt                     *time.Time              `json:"started_at,omitempty"`
	CompletedAt                   *time.Time              `json:"completed_at,omitempty"`
	UpdatedAt                     time.Time               `json:"updated_at"`
}

// TransformDeploymentEntity transforms an ent.Deployment entity into a DeploymentResponse
func TransformDeploymentEntity(entity *ent.Deployment) *DeploymentResponse {
	response := &DeploymentResponse{}
	if entity != nil {
		response = &DeploymentResponse{
			ID:                            entity.ID,
			ServiceID:                     entity.ServiceID,
			Status:                        entity.Status,
			JobName:                       entity.KubernetesJobName,
			Error:                         entity.Error,
			Attempts:                      entity.Attempts,
			CommitSHA:                     entity.CommitSha,
			CommitMessage:                 entity.CommitMessage,
			GitBranch:                     entity.GitBranch,
			CommitAuthor:                  entity.CommitAuthor,
			Image:                         entity.Image,
			CreatedAt:                     entity.CreatedAt,
			QueuedAt:                      entity.QueuedAt,
			StartedAt:                     entity.StartedAt,
			CompletedAt:                   entity.CompletedAt,
			UpdatedAt:                     entity.UpdatedAt,
			CrashingReasons:               []string{},
			InstanceEvents:                []EventRecord{},
			Builder:                       entity.Builder,
			RailpackBuilderInstallCommand: entity.RailpackBuilderInstallCommand,
			RailpackBuilderBuildCommand:   entity.RailpackBuilderBuildCommand,
			RunCommand:                    entity.RunCommand,
			DockerBuilderDockerfilePath:   entity.DockerBuilderDockerfilePath,
			DockerBuilderBuildContext:     entity.DockerBuilderBuildContext,
		}
	}
	return response
}

// Transforms a slice of ent.Deployment entities into a slice of DeploymentResponse
func TransformDeploymentEntities(entities []*ent.Deployment) []*DeploymentResponse {
	responses := make([]*DeploymentResponse, len(entities))
	for i, entity := range entities {
		responses[i] = TransformDeploymentEntity(entity)
	}
	return responses
}
