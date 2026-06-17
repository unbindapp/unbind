package deployment_repo

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/deployment"
	"github.com/unbindapp/unbind-api/ent/schema"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	v1 "github.com/unbindapp/unbind-operator/api/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type DeploymentMutationsSuite struct {
	repository.RepositoryBaseSuite
	deploymentRepo *DeploymentRepository
	testData       struct {
		team        *ent.Team
		project     *ent.Project
		environment *ent.Environment
		service     *ent.Service
		deployment  *ent.Deployment
	}
}

func (suite *DeploymentMutationsSuite) SetupTest() {
	suite.RepositoryBaseSuite.SetupTest()
	suite.deploymentRepo = NewDeploymentRepository(suite.DB)

	// Create test data hierarchy: Team -> Project -> Environment -> Service -> Deployment
	suite.testData.team = suite.DB.Team.Create().
		SetKubernetesName("test-team").
		SetName("Test Team").
		SetNamespace("test-team").
		SetKubernetesSecret("test-team-secret").
		SaveX(suite.Ctx)

	suite.testData.project = suite.DB.Project.Create().
		SetKubernetesName("test-project").
		SetName("Test Project").
		SetTeamID(suite.testData.team.ID).
		SetKubernetesSecret("test-project-secret").
		SaveX(suite.Ctx)

	suite.testData.environment = suite.DB.Environment.Create().
		SetKubernetesName("test-env").
		SetName("Test Environment").
		SetProjectID(suite.testData.project.ID).
		SetKubernetesSecret("test-env-secret").
		SaveX(suite.Ctx)

	suite.testData.service = suite.DB.Service.Create().
		SetType(schema.ServiceTypeGithub).
		SetKubernetesName("test-service").
		SetName("Test Service").
		SetEnvironmentID(suite.testData.environment.ID).
		SetKubernetesSecret("test-service-secret").
		SaveX(suite.Ctx)
	suite.DB.ServiceConfig.Create().
		SetBuilder(schema.ServiceBuilderDocker).
		SetServiceID(suite.testData.service.ID).
		SetBuilder(schema.ServiceBuilderRailpack).
		SetIcon("database").SaveX(suite.Ctx)

	suite.testData.deployment = suite.DB.Deployment.Create().
		SetServiceID(suite.testData.service.ID).
		SetStatus(schema.DeploymentStatusBuildQueued).
		SetSource(schema.DeploymentSourceManual).
		SetCommitSha("abc123").
		SetCommitMessage("Initial commit").
		SetCommitAuthor(&schema.GitCommitter{
			Name:      "Test User",
			AvatarURL: "https://github.com/test.png",
		}).
		SetBuilder(schema.ServiceBuilderDocker).
		SaveX(suite.Ctx)
}

func (suite *DeploymentMutationsSuite) TearDownTest() {
	suite.RepositoryBaseSuite.TearDownTest()
	suite.deploymentRepo = nil
}

func (suite *DeploymentMutationsSuite) TestCreate() {
	suite.Run("Create Success", func() {
		committer := &schema.GitCommitter{
			Name:      "John Doe",
			AvatarURL: "https://github.com/johndoe.png",
		}

		deployment, err := suite.deploymentRepo.Create(
			suite.Ctx,
			nil,
			suite.testData.service.ID,
			"def456",
			"New feature commit",
			"master",
			committer,
			schema.DeploymentSourceGit,
			schema.DeploymentStatusBuildQueued,
		)

		suite.NoError(err)
		suite.NotNil(deployment)
		suite.Equal(suite.testData.service.ID, deployment.ServiceID)
		suite.Equal("def456", *deployment.CommitSha)
		suite.Equal("New feature commit", *deployment.CommitMessage)
		suite.Equal("master", *deployment.GitBranch)
		suite.Equal(committer, deployment.CommitAuthor)
		suite.Equal(schema.DeploymentSourceGit, deployment.Source)
		suite.Equal(schema.DeploymentStatusBuildQueued, deployment.Status)
		suite.NotNil(deployment.QueuedAt)
	})

	suite.Run("Create Success Without Optional Fields", func() {
		deployment, err := suite.deploymentRepo.Create(
			suite.Ctx,
			nil,
			suite.testData.service.ID,
			"",
			"",
			"",
			&schema.GitCommitter{
				Name:      "Jane Doe",
				AvatarURL: "https://github.com/janedoe.png",
			},
			schema.DeploymentSourceManual,
			schema.DeploymentStatusBuildFailed,
		)

		suite.NoError(err)
		suite.NotNil(deployment)
		suite.Equal(suite.testData.service.ID, deployment.ServiceID)
		suite.Nil(deployment.CommitSha)
		suite.Nil(deployment.CommitMessage)
		suite.Nil(deployment.GitBranch)
		suite.Equal(schema.DeploymentSourceManual, deployment.Source)
		suite.Equal(schema.DeploymentStatusBuildFailed, deployment.Status)
		suite.Nil(deployment.QueuedAt) // Only set for BuildQueued status
	})

	suite.Run("Create Error with Invalid Service ID", func() {
		invalidServiceID := uuid.New()
		_, err := suite.deploymentRepo.Create(
			suite.Ctx,
			nil,
			invalidServiceID,
			"abc123",
			"Test commit",
			"master",
			&schema.GitCommitter{
				Name:      "Test User",
				AvatarURL: "https://github.com/test.png",
			},
			schema.DeploymentSourceManual,
			schema.DeploymentStatusBuildQueued,
		)

		suite.Error(err)
		suite.True(ent.IsNotFound(err), "Expected not found error for invalid service ID")
	})

	suite.Run("Create Error when DB closed", func() {
		suite.DB.Close()
		_, err := suite.deploymentRepo.Create(
			suite.Ctx,
			nil,
			suite.testData.service.ID,
			"abc123",
			"Test commit",
			"master",
			&schema.GitCommitter{
				Name:      "Test User",
				AvatarURL: "https://github.com/test.png",
			},
			schema.DeploymentSourceManual,
			schema.DeploymentStatusBuildQueued,
		)

		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *DeploymentMutationsSuite) TestMarkQueued() {
	suite.Run("MarkQueued Success", func() {
		queuedTime := time.Now()
		deployment, err := suite.deploymentRepo.MarkQueued(
			suite.Ctx,
			nil,
			suite.testData.deployment.ID,
			queuedTime,
		)

		suite.NoError(err)
		suite.NotNil(deployment)
		suite.Equal(schema.DeploymentStatusBuildQueued, deployment.Status)
		suite.NotNil(deployment.QueuedAt)
		suite.WithinDuration(queuedTime, *deployment.QueuedAt, time.Second)
	})

	suite.Run("MarkQueued Error with Invalid ID", func() {
		invalidID := uuid.New()
		_, err := suite.deploymentRepo.MarkQueued(
			suite.Ctx,
			nil,
			invalidID,
			time.Now(),
		)

		suite.Error(err)
		suite.ErrorContains(err, "not found")
	})

	suite.Run("MarkQueued Error when DB closed", func() {
		suite.DB.Close()
		_, err := suite.deploymentRepo.MarkQueued(
			suite.Ctx,
			nil,
			suite.testData.deployment.ID,
			time.Now(),
		)

		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *DeploymentMutationsSuite) TestMarkStarted() {
	suite.Run("MarkStarted Success", func() {
		startedTime := time.Now()
		deployment, err := suite.deploymentRepo.MarkStarted(
			suite.Ctx,
			nil,
			suite.testData.deployment.ID,
			startedTime,
		)

		suite.NoError(err)
		suite.NotNil(deployment)
		suite.Equal(schema.DeploymentStatusBuildRunning, deployment.Status)
		suite.Equal(1, deployment.Attempts)
		suite.NotNil(deployment.StartedAt)
		suite.WithinDuration(startedTime, *deployment.StartedAt, time.Second)
	})

	suite.Run("MarkStarted Error with Invalid ID", func() {
		invalidID := uuid.New()
		_, err := suite.deploymentRepo.MarkStarted(
			suite.Ctx,
			nil,
			invalidID,
			time.Now(),
		)

		suite.Error(err)
		suite.ErrorContains(err, "not found")
	})

	suite.Run("MarkStarted Error when DB closed", func() {
		suite.DB.Close()
		_, err := suite.deploymentRepo.MarkStarted(
			suite.Ctx,
			nil,
			suite.testData.deployment.ID,
			time.Now(),
		)

		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *DeploymentMutationsSuite) TestMarkFailed() {
	suite.Run("MarkFailed Success", func() {
		failedTime := time.Now()
		errorMessage := "Build failed due to compilation error"
		deployment, err := suite.deploymentRepo.MarkFailed(
			suite.Ctx,
			nil,
			suite.testData.deployment.ID,
			errorMessage,
			failedTime,
		)

		suite.NoError(err)
		suite.NotNil(deployment)
		suite.Equal(schema.DeploymentStatusBuildFailed, deployment.Status)
		suite.Equal(errorMessage, deployment.Error) // Error is optional string, not pointer
		suite.NotNil(deployment.CompletedAt)
		suite.WithinDuration(failedTime, *deployment.CompletedAt, time.Second)
	})

	suite.Run("MarkFailed Error with Already Succeeded Deployment", func() {
		// First mark as succeeded
		succeededDeployment := suite.DB.Deployment.Create().
			SetServiceID(suite.testData.service.ID).
			SetStatus(schema.DeploymentStatusBuildSucceeded).
			SetSource(schema.DeploymentSourceManual).
			SetBuilder(schema.ServiceBuilderDocker).
			SetCommitAuthor(&schema.GitCommitter{
				Name:      "Test User",
				AvatarURL: "https://github.com/test.png",
			}).
			SaveX(suite.Ctx)

		// Try to mark as failed - should not work due to WHERE condition
		_, err := suite.deploymentRepo.MarkFailed(
			suite.Ctx,
			nil,
			succeededDeployment.ID,
			"Should not work",
			time.Now(),
		)

		suite.Error(err)
		suite.ErrorContains(err, "not found")
	})

	suite.Run("MarkFailed Error with Invalid ID", func() {
		invalidID := uuid.New()
		_, err := suite.deploymentRepo.MarkFailed(
			suite.Ctx,
			nil,
			invalidID,
			"Error message",
			time.Now(),
		)

		suite.Error(err)
		suite.ErrorContains(err, "not found")
	})

	suite.Run("MarkFailed Error when DB closed", func() {
		suite.DB.Close()
		_, err := suite.deploymentRepo.MarkFailed(
			suite.Ctx,
			nil,
			suite.testData.deployment.ID,
			"Error message",
			time.Now(),
		)

		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *DeploymentMutationsSuite) TestMarkSucceeded() {
	suite.Run("MarkSucceeded Success", func() {
		completedTime := time.Now()
		deployment, err := suite.deploymentRepo.MarkSucceeded(
			suite.Ctx,
			nil,
			suite.testData.deployment.ID,
			completedTime,
		)

		suite.NoError(err)
		suite.NotNil(deployment)
		suite.Equal(schema.DeploymentStatusBuildSucceeded, deployment.Status)
		suite.NotNil(deployment.CompletedAt)
		suite.WithinDuration(completedTime, *deployment.CompletedAt, time.Second)
	})

	suite.Run("MarkSucceeded Error with Invalid ID", func() {
		invalidID := uuid.New()
		_, err := suite.deploymentRepo.MarkSucceeded(
			suite.Ctx,
			nil,
			invalidID,
			time.Now(),
		)

		suite.Error(err)
		suite.ErrorContains(err, "not found")
	})

	suite.Run("MarkSucceeded Error when DB closed", func() {
		suite.DB.Close()
		_, err := suite.deploymentRepo.MarkSucceeded(
			suite.Ctx,
			nil,
			suite.testData.deployment.ID,
			time.Now(),
		)

		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *DeploymentMutationsSuite) TestMarkCancelledExcept() {
	suite.Run("MarkCancelledExcept Success", func() {
		// Create additional deployments for the same service
		deployment2 := suite.DB.Deployment.Create().
			SetServiceID(suite.testData.service.ID).
			SetStatus(schema.DeploymentStatusBuildQueued).
			SetSource(schema.DeploymentSourceManual).
			SetBuilder(schema.ServiceBuilderDocker).
			SetCommitAuthor(&schema.GitCommitter{
				Name:      "Test User",
				AvatarURL: "https://github.com/test.png",
			}).
			SaveX(suite.Ctx)

		deployment3 := suite.DB.Deployment.Create().
			SetServiceID(suite.testData.service.ID).
			SetStatus(schema.DeploymentStatusBuildRunning).
			SetSource(schema.DeploymentSourceManual).
			SetBuilder(schema.ServiceBuilderDocker).
			SetCommitAuthor(&schema.GitCommitter{
				Name:      "Test User",
				AvatarURL: "https://github.com/test.png",
			}).
			SaveX(suite.Ctx)

		err := suite.deploymentRepo.MarkCancelledExcept(
			suite.Ctx,
			suite.testData.service.ID,
			suite.testData.deployment.ID,
		)

		suite.NoError(err)

		// Check that other deployments were cancelled but not the excepted one
		deployments := suite.DB.Deployment.Query().
			Where(deployment.ServiceIDEQ(suite.testData.service.ID)).
			AllX(suite.Ctx)

		for _, d := range deployments {
			if d.ID == suite.testData.deployment.ID {
				suite.Equal(schema.DeploymentStatusBuildQueued, d.Status) // Original status
			} else {
				suite.Equal(schema.DeploymentStatusBuildCancelled, d.Status)
				suite.NotNil(d.CompletedAt)
			}
		}

		// Use deployment2 and deployment3 to avoid unused variable warning
		suite.NotEqual(deployment2.ID, suite.testData.deployment.ID)
		suite.NotEqual(deployment3.ID, suite.testData.deployment.ID)
	})

	suite.Run("MarkCancelledExcept Error when DB closed", func() {
		suite.DB.Close()
		err := suite.deploymentRepo.MarkCancelledExcept(
			suite.Ctx,
			suite.testData.service.ID,
			suite.testData.deployment.ID,
		)

		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *DeploymentMutationsSuite) TestMarkAsCancelled() {
	suite.Run("MarkAsCancelled Success", func() {
		// Create additional deployments
		deployment2 := suite.DB.Deployment.Create().
			SetServiceID(suite.testData.service.ID).
			SetStatus(schema.DeploymentStatusBuildQueued).
			SetSource(schema.DeploymentSourceManual).
			SetBuilder(schema.ServiceBuilderDocker).
			SetCommitAuthor(&schema.GitCommitter{
				Name:      "Test User",
				AvatarURL: "https://github.com/test.png",
			}).
			SaveX(suite.Ctx)

		jobIDs := []uuid.UUID{suite.testData.deployment.ID, deployment2.ID}
		err := suite.deploymentRepo.MarkAsCancelled(suite.Ctx, jobIDs)

		suite.NoError(err)

		// Check that deployments were cancelled
		deployments := suite.DB.Deployment.Query().
			Where(deployment.IDIn(jobIDs...)).
			AllX(suite.Ctx)

		for _, d := range deployments {
			suite.Equal(schema.DeploymentStatusBuildCancelled, d.Status)
			suite.NotNil(d.CompletedAt)
		}
	})

	suite.Run("MarkAsCancelled No Effect on Running Deployment", func() {
		// Create running deployment
		runningDeployment := suite.DB.Deployment.Create().
			SetServiceID(suite.testData.service.ID).
			SetStatus(schema.DeploymentStatusBuildRunning).
			SetSource(schema.DeploymentSourceManual).
			SetBuilder(schema.ServiceBuilderDocker).
			SetCommitAuthor(&schema.GitCommitter{
				Name:      "Test User",
				AvatarURL: "https://github.com/test.png",
			}).
			SaveX(suite.Ctx)

		jobIDs := []uuid.UUID{runningDeployment.ID}
		err := suite.deploymentRepo.MarkAsCancelled(suite.Ctx, jobIDs)

		suite.NoError(err)

		// Check that running deployment was not affected
		deployment := suite.DB.Deployment.GetX(suite.Ctx, runningDeployment.ID)
		suite.Equal(schema.DeploymentStatusBuildRunning, deployment.Status)
	})

	suite.Run("MarkAsCancelled Error when DB closed", func() {
		suite.DB.Close()
		err := suite.deploymentRepo.MarkAsCancelled(suite.Ctx, []uuid.UUID{suite.testData.deployment.ID})

		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *DeploymentMutationsSuite) TestAssignKubernetesJobName() {
	suite.Run("AssignKubernetesJobName Success", func() {
		jobName := "test-job-12345"
		deployment, err := suite.deploymentRepo.AssignKubernetesJobName(
			suite.Ctx,
			suite.testData.deployment.ID,
			jobName,
		)

		suite.NoError(err)
		suite.NotNil(deployment)
		suite.Equal(jobName, deployment.KubernetesJobName)
	})

	suite.Run("AssignKubernetesJobName Error with Invalid ID", func() {
		invalidID := uuid.New()
		_, err := suite.deploymentRepo.AssignKubernetesJobName(
			suite.Ctx,
			invalidID,
			"test-job",
		)

		suite.Error(err)
		suite.ErrorContains(err, "not found")
	})

	suite.Run("AssignKubernetesJobName Error when DB closed", func() {
		suite.DB.Close()
		_, err := suite.deploymentRepo.AssignKubernetesJobName(
			suite.Ctx,
			suite.testData.deployment.ID,
			"test-job",
		)

		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *DeploymentMutationsSuite) TestSetKubernetesJobStatus() {
	suite.Run("SetKubernetesJobStatus Success", func() {
		status := "Running"
		deployment, err := suite.deploymentRepo.SetKubernetesJobStatus(
			suite.Ctx,
			suite.testData.deployment.ID,
			status,
		)

		suite.NoError(err)
		suite.NotNil(deployment)
		suite.Equal(status, deployment.KubernetesJobStatus)
	})

	suite.Run("SetKubernetesJobStatus Error with Invalid ID", func() {
		invalidID := uuid.New()
		_, err := suite.deploymentRepo.SetKubernetesJobStatus(
			suite.Ctx,
			invalidID,
			"Failed",
		)

		suite.Error(err)
		suite.ErrorContains(err, "not found")
	})

	suite.Run("SetKubernetesJobStatus Error when DB closed", func() {
		suite.DB.Close()
		_, err := suite.deploymentRepo.SetKubernetesJobStatus(
			suite.Ctx,
			suite.testData.deployment.ID,
			"Completed",
		)

		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *DeploymentMutationsSuite) TestAttachDeploymentMetadata() {
	suite.Run("AttachDeploymentMetadata Success", func() {
		imageName := "test-image:v1.0.0"
		resourceDefinition := &v1.Service{
			TypeMeta: metav1.TypeMeta{
				Kind:       "Service",
				APIVersion: "v1",
			},
			ObjectMeta: metav1.ObjectMeta{
				Name:      "test-service",
				Namespace: "default",
			},
			Spec: v1.ServiceSpec{
				EnvVars: []corev1.EnvVar{
					{
						Name:  "SECRET_KEY",
						Value: "sensitive-value",
					},
				},
			},
		}

		deployment, err := suite.deploymentRepo.AttachDeploymentMetadata(
			suite.Ctx,
			nil,
			suite.testData.deployment.ID,
			imageName,
			resourceDefinition,
		)

		suite.NoError(err)
		suite.NotNil(deployment)
		suite.Equal(imageName, *deployment.Image)
		suite.NotNil(deployment.ResourceDefinition)
		// Verify sensitive data was pruned
		suite.Empty(deployment.ResourceDefinition.Spec.EnvVars)
	})

	suite.Run("AttachDeploymentMetadata Success with Nil Resource", func() {
		imageName := "test-image:v2.0.0"
		deployment, err := suite.deploymentRepo.AttachDeploymentMetadata(
			suite.Ctx,
			nil,
			suite.testData.deployment.ID,
			imageName,
			nil,
		)

		suite.NoError(err)
		suite.NotNil(deployment)
		suite.Equal(imageName, *deployment.Image)
		suite.Nil(deployment.ResourceDefinition)
	})

	suite.Run("AttachDeploymentMetadata Error with Invalid ID", func() {
		invalidID := uuid.New()
		_, err := suite.deploymentRepo.AttachDeploymentMetadata(
			suite.Ctx,
			nil,
			invalidID,
			"test-image:latest",
			nil,
		)

		suite.Error(err)
		suite.ErrorContains(err, "not found")
	})

	suite.Run("AttachDeploymentMetadata Error when DB closed", func() {
		suite.DB.Close()
		_, err := suite.deploymentRepo.AttachDeploymentMetadata(
			suite.Ctx,
			nil,
			suite.testData.deployment.ID,
			"test-image:latest",
			nil,
		)

		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *DeploymentMutationsSuite) TestCreateCopy() {
	suite.Run("CreateCopy Success", func() {
		// First, populate the original deployment with metadata
		originalDeployment := suite.DB.Deployment.UpdateOneID(suite.testData.deployment.ID).
			SetImage("original-image:v1.0.0").
			SetResourceDefinition(&v1.Service{
				TypeMeta: metav1.TypeMeta{
					Kind:       "Service",
					APIVersion: "v1",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-service",
					Namespace: "default",
				},
				Spec: v1.ServiceSpec{},
			}).
			SaveX(suite.Ctx)

		copy, err := suite.deploymentRepo.CreateCopy(
			suite.Ctx,
			nil,
			originalDeployment,
		)

		suite.NoError(err)
		suite.NotNil(copy)
		suite.NotEqual(originalDeployment.ID, copy.ID)
		suite.Equal(originalDeployment.ServiceID, copy.ServiceID)
		suite.Equal(schema.DeploymentStatusBuildQueued, copy.Status)
		suite.Equal(schema.DeploymentSourceManual, copy.Source)
		suite.Equal(originalDeployment.CommitSha, copy.CommitSha)
		suite.Equal(originalDeployment.CommitMessage, copy.CommitMessage)
		suite.Equal(originalDeployment.CommitAuthor, copy.CommitAuthor)
		suite.Equal(originalDeployment.Image, copy.Image)
		suite.Equal(originalDeployment.ResourceDefinition, copy.ResourceDefinition)
		// Ensure reset fields are nil/default
		suite.Nil(copy.CompletedAt)
		suite.Nil(copy.StartedAt)
		suite.Equal("", copy.Error) // Error is optional string, defaults to empty
	})

	suite.Run("CreateCopy Error when DB closed", func() {
		suite.DB.Close()
		_, err := suite.deploymentRepo.CreateCopy(
			suite.Ctx,
			nil,
			suite.testData.deployment,
		)

		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func TestDeploymentMutationsSuite(t *testing.T) {
	suite.Run(t, new(DeploymentMutationsSuite))
}
