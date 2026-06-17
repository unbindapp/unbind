package deployment_repo

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/deployment"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/ent/service"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	v1 "github.com/unbindapp/unbind-operator/api/v1"
	corev1 "k8s.io/api/core/v1"
)

func (self *DeploymentRepository) Create(ctx context.Context,
	tx repository.TxInterface,
	serviceID uuid.UUID,
	CommitSHA,
	CommitMessage string,
	GitBranch string,
	committer *schema.GitCommitter,
	source schema.DeploymentSource,
	initialStatus schema.DeploymentStatus) (*ent.Deployment, error) {
	db := self.base.DB
	if tx != nil {
		db = tx.Client()
	}

	// Fetch service to get build configuration
	service, err := db.Service.Query().
		Where(service.ID(serviceID)).
		WithServiceConfig().
		Only(ctx)
	if err != nil {
		return nil, err
	}

	c := db.Deployment.Create().
		SetServiceID(serviceID).
		SetStatus(initialStatus).
		SetSource(source).
		SetCommitAuthor(committer)

	// Store build-related values from service config to preserve for redeployments
	c.SetBuilder(service.Edges.ServiceConfig.Builder)
	if service.Edges.ServiceConfig.RailpackBuilderInstallCommand != nil {
		c.SetRailpackBuilderInstallCommand(*service.Edges.ServiceConfig.RailpackBuilderInstallCommand)
	}
	if service.Edges.ServiceConfig.RailpackBuilderBuildCommand != nil {
		c.SetRailpackBuilderBuildCommand(*service.Edges.ServiceConfig.RailpackBuilderBuildCommand)
	}
	if service.Edges.ServiceConfig.RunCommand != nil {
		c.SetRunCommand(*service.Edges.ServiceConfig.RunCommand)
	}
	if service.Edges.ServiceConfig.DockerBuilderDockerfilePath != nil {
		c.SetDockerBuilderDockerfilePath(*service.Edges.ServiceConfig.DockerBuilderDockerfilePath)
	}
	if service.Edges.ServiceConfig.DockerBuilderBuildContext != nil {
		c.SetDockerBuilderBuildContext(*service.Edges.ServiceConfig.DockerBuilderBuildContext)
	}

	if CommitSHA != "" {
		c.SetCommitSha(CommitSHA)
	}
	if CommitMessage != "" {
		c.SetCommitMessage(CommitMessage)
	}
	if GitBranch != "" {
		c.SetGitBranch(strings.TrimPrefix(GitBranch, "refs/heads/"))
	}
	if initialStatus == schema.DeploymentStatusBuildQueued {
		c.SetQueuedAt(time.Now())
	}
	return c.Save(ctx)
}

func (self *DeploymentRepository) MarkQueued(ctx context.Context, tx repository.TxInterface, deploymentID uuid.UUID, queuedAt time.Time) (*ent.Deployment, error) {
	db := self.base.DB
	if tx != nil {
		db = tx.Client()
	}

	return db.Deployment.UpdateOneID(deploymentID).
		SetStatus(schema.DeploymentStatusBuildQueued).
		SetQueuedAt(queuedAt).
		Save(ctx)
}

func (self *DeploymentRepository) MarkStarted(ctx context.Context, tx repository.TxInterface, deploymentID uuid.UUID, startedAt time.Time) (*ent.Deployment, error) {
	db := self.base.DB
	if tx != nil {
		db = tx.Client()
	}

	return db.Deployment.UpdateOneID(deploymentID).
		SetStatus(schema.DeploymentStatusBuildRunning).
		// ! TODO - retry deployments?
		SetAttempts(1).
		SetStartedAt(startedAt).
		Save(ctx)
}

func (self *DeploymentRepository) MarkFailed(ctx context.Context, tx repository.TxInterface, deploymentID uuid.UUID, message string, failedAt time.Time) (*ent.Deployment, error) {
	db := self.base.DB
	if tx != nil {
		db = tx.Client()
	}

	return db.Deployment.UpdateOneID(deploymentID).
		Where(
			deployment.StatusNotIn(schema.DeploymentStatusBuildCancelled, schema.DeploymentStatusBuildSucceeded),
		).
		SetStatus(schema.DeploymentStatusBuildFailed).
		SetCompletedAt(failedAt).
		SetError(message).
		Save(ctx)
}

func (self *DeploymentRepository) MarkSucceeded(ctx context.Context, tx repository.TxInterface, deploymentID uuid.UUID, completedAt time.Time) (*ent.Deployment, error) {
	db := self.base.DB
	if tx != nil {
		db = tx.Client()
	}

	return db.Deployment.UpdateOneID(deploymentID).
		SetStatus(schema.DeploymentStatusBuildSucceeded).
		SetCompletedAt(completedAt).
		Save(ctx)
}

// Cancels all jobs that are not in a finished state
func (self *DeploymentRepository) MarkCancelledExcept(ctx context.Context, serviceID uuid.UUID, deploymentID uuid.UUID) error {
	return self.base.DB.Deployment.Update().
		SetStatus(schema.DeploymentStatusBuildCancelled).
		SetCompletedAt(time.Now()).
		Where(
			deployment.ServiceIDEQ(serviceID),
			deployment.IDNEQ(deploymentID),
			deployment.StatusNotIn(schema.DeploymentStatusBuildFailed, schema.DeploymentStatusBuildCancelled, schema.DeploymentStatusBuildSucceeded),
		).
		Exec(ctx)
}

// Mark cancelled by IDs
func (self *DeploymentRepository) MarkAsCancelled(ctx context.Context, jobIDs []uuid.UUID) error {
	return self.base.DB.Deployment.Update().
		SetStatus(schema.DeploymentStatusBuildCancelled).
		SetCompletedAt(time.Now()).
		Where(
			deployment.IDIn(jobIDs...),
			deployment.StatusNotIn(schema.DeploymentStatusBuildRunning, schema.DeploymentStatusBuildFailed, schema.DeploymentStatusBuildCancelled, schema.DeploymentStatusBuildSucceeded),
		).
		Exec(ctx)
}

// Assigns the kubernetes "Job" name to the build job
func (self *DeploymentRepository) AssignKubernetesJobName(ctx context.Context, deploymentID uuid.UUID, jobName string) (*ent.Deployment, error) {
	return self.base.DB.Deployment.UpdateOneID(deploymentID).
		SetKubernetesJobName(jobName).
		Save(ctx)
}

func (self *DeploymentRepository) SetKubernetesJobStatus(ctx context.Context, deploymentID uuid.UUID, status string) (*ent.Deployment, error) {
	return self.base.DB.Deployment.UpdateOneID(deploymentID).
		SetKubernetesJobStatus(status).
		Save(ctx)
}

func (self *DeploymentRepository) AttachDeploymentMetadata(ctx context.Context, tx repository.TxInterface, deploymentID uuid.UUID, imageName string, resourceDefinition *v1.Service) (*ent.Deployment, error) {
	db := self.base.DB
	if tx != nil {
		db = tx.Client()
	}

	// Prune any sensitive data
	if resourceDefinition != nil {
		resourceDefinition.Spec.EnvVars = []corev1.EnvVar{}
	}

	return db.Deployment.UpdateOneID(deploymentID).
		SetImage(imageName).
		SetResourceDefinition(resourceDefinition).
		Save(ctx)
}

// Create a copy with all metadata, except for failed_at, completed_at, and status
func (self *DeploymentRepository) CreateCopy(ctx context.Context, tx repository.TxInterface, deployment *ent.Deployment) (*ent.Deployment, error) {
	db := self.base.DB
	if tx != nil {
		db = tx.Client()
	}

	return db.Deployment.Create().
		SetServiceID(deployment.ServiceID).
		SetStatus(schema.DeploymentStatusBuildQueued).
		SetNillableCommitSha(deployment.CommitSha).
		SetNillableCommitMessage(deployment.CommitMessage).
		SetNillableGitBranch(deployment.GitBranch).
		SetCommitAuthor(deployment.CommitAuthor).
		SetResourceDefinition(deployment.ResourceDefinition).
		SetSource(schema.DeploymentSourceManual).
		SetNillableImage(deployment.Image).
		// Copy build-related fields to preserve build configuration for redeployments
		SetBuilder(deployment.Builder).
		SetNillableRailpackBuilderInstallCommand(deployment.RailpackBuilderInstallCommand).
		SetNillableRailpackBuilderBuildCommand(deployment.RailpackBuilderBuildCommand).
		SetNillableRunCommand(deployment.RunCommand).
		SetNillableDockerBuilderDockerfilePath(deployment.DockerBuilderDockerfilePath).
		SetNillableDockerBuilderBuildContext(deployment.DockerBuilderBuildContext).
		Save(ctx)
}
