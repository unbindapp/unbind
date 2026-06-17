package deployment_repo

import (
	"fmt"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
)

type DeploymentQueriesSuite struct {
	repository.RepositoryBaseSuite
	deploymentRepo  *DeploymentRepository
	testTeam        *ent.Team
	testProject     *ent.Project
	testEnvironment *ent.Environment
	testService     *ent.Service
	testDeployment  *ent.Deployment
}

func (suite *DeploymentQueriesSuite) SetupTest() {
	suite.RepositoryBaseSuite.SetupTest()
	suite.deploymentRepo = NewDeploymentRepository(suite.DB)

	// Create test data hierarchy
	suite.testTeam = suite.DB.Team.Create().
		SetName("test-team").
		SetNamespace("test-namespace").
		SetKubernetesName("test-team-k8s").
		SetKubernetesSecret("test-secret").
		SaveX(suite.Ctx)

	suite.testProject = suite.DB.Project.Create().
		SetName("test-project").
		SetKubernetesName("test-project-k8s").
		SetKubernetesSecret("test-secret").
		SetTeamID(suite.testTeam.ID).
		SaveX(suite.Ctx)

	suite.testEnvironment = suite.DB.Environment.Create().
		SetName("test-environment").
		SetKubernetesName("test-env-k8s").
		SetProjectID(suite.testProject.ID).
		SetKubernetesSecret("test-secret").
		SaveX(suite.Ctx)

	suite.testService = suite.DB.Service.Create().
		SetName("test-service").
		SetType(schema.ServiceTypeDockerimage).
		SetEnvironmentID(suite.testEnvironment.ID).
		SetKubernetesSecret("test-secret").
		SetKubernetesName("test-service-k8s").
		SaveX(suite.Ctx)

	committer := &schema.GitCommitter{
		Name: "Test User",
	}

	suite.testDeployment = suite.DB.Deployment.Create().
		SetServiceID(suite.testService.ID).
		SetCommitSha("abc123").
		SetCommitMessage("Test commit").
		SetCommitAuthor(committer).
		SetSource(schema.DeploymentSourceGit).
		SetStatus(schema.DeploymentStatusBuildQueued).
		SetBuilder(schema.ServiceBuilderDocker).
		SetQueuedAt(time.Now()).
		SaveX(suite.Ctx)
}

func (suite *DeploymentQueriesSuite) TearDownTest() {
	suite.RepositoryBaseSuite.TearDownTest()
	suite.deploymentRepo = nil
	suite.testTeam = nil
	suite.testProject = nil
	suite.testEnvironment = nil
	suite.testService = nil
	suite.testDeployment = nil
}

func (suite *DeploymentQueriesSuite) TestGetByID() {
	suite.Run("GetByID Success", func() {
		deployment, err := suite.deploymentRepo.GetByID(suite.Ctx, suite.testDeployment.ID)
		suite.NoError(err)
		suite.NotNil(deployment)
		suite.Equal(suite.testDeployment.ID, deployment.ID)
		suite.Equal("abc123", *deployment.CommitSha)
		suite.Equal("Test commit", *deployment.CommitMessage)
		suite.Equal(schema.DeploymentStatusBuildQueued, deployment.Status)
	})

	suite.Run("GetByID Not Found", func() {
		nonExistentID := uuid.New()
		deployment, err := suite.deploymentRepo.GetByID(suite.Ctx, nonExistentID)
		suite.Error(err)
		suite.Nil(deployment)
	})

	suite.Run("GetByID Error when DB closed", func() {
		suite.DB.Close()
		deployment, err := suite.deploymentRepo.GetByID(suite.Ctx, suite.testDeployment.ID)
		suite.Error(err)
		suite.Nil(deployment)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *DeploymentQueriesSuite) TestExistsInEnvironment() {
	suite.Run("ExistsInEnvironment True", func() {
		exists, err := suite.deploymentRepo.ExistsInEnvironment(suite.Ctx, suite.testDeployment.ID, suite.testEnvironment.ID)
		suite.NoError(err)
		suite.True(exists)
	})

	suite.Run("ExistsInEnvironment False - Wrong Environment", func() {
		// Create another environment
		anotherEnv := suite.DB.Environment.Create().
			SetName("another-environment").
			SetKubernetesName("another-env-k8s").
			SetProjectID(suite.testProject.ID).
			SetKubernetesSecret("test-secret").
			SaveX(suite.Ctx)

		exists, err := suite.deploymentRepo.ExistsInEnvironment(suite.Ctx, suite.testDeployment.ID, anotherEnv.ID)
		suite.NoError(err)
		suite.False(exists)
	})

	suite.Run("ExistsInEnvironment False - Non-existent Deployment", func() {
		nonExistentID := uuid.New()
		exists, err := suite.deploymentRepo.ExistsInEnvironment(suite.Ctx, nonExistentID, suite.testEnvironment.ID)
		suite.NoError(err)
		suite.False(exists)
	})

	suite.Run("ExistsInEnvironment Error when DB closed", func() {
		suite.DB.Close()
		exists, err := suite.deploymentRepo.ExistsInEnvironment(suite.Ctx, suite.testDeployment.ID, suite.testEnvironment.ID)
		suite.Error(err)
		suite.False(exists)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *DeploymentQueriesSuite) TestExistsInProject() {
	suite.Run("ExistsInProject True", func() {
		exists, err := suite.deploymentRepo.ExistsInProject(suite.Ctx, suite.testDeployment.ID, suite.testProject.ID)
		suite.NoError(err)
		suite.True(exists)
	})

	suite.Run("ExistsInProject False - Wrong Project", func() {
		// Create another project
		anotherProject := suite.DB.Project.Create().
			SetName("another-project").
			SetKubernetesName("another-project-k8s").
			SetKubernetesSecret("another-secret").
			SetTeamID(suite.testTeam.ID).
			SaveX(suite.Ctx)

		exists, err := suite.deploymentRepo.ExistsInProject(suite.Ctx, suite.testDeployment.ID, anotherProject.ID)
		suite.NoError(err)
		suite.False(exists)
	})

	suite.Run("ExistsInProject False - Non-existent Deployment", func() {
		nonExistentID := uuid.New()
		exists, err := suite.deploymentRepo.ExistsInProject(suite.Ctx, nonExistentID, suite.testProject.ID)
		suite.NoError(err)
		suite.False(exists)
	})

	suite.Run("ExistsInProject Error when DB closed", func() {
		suite.DB.Close()
		exists, err := suite.deploymentRepo.ExistsInProject(suite.Ctx, suite.testDeployment.ID, suite.testProject.ID)
		suite.Error(err)
		suite.False(exists)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *DeploymentQueriesSuite) TestExistsInTeam() {
	suite.Run("ExistsInTeam True", func() {
		exists, err := suite.deploymentRepo.ExistsInTeam(suite.Ctx, suite.testDeployment.ID, suite.testTeam.ID)
		suite.NoError(err)
		suite.True(exists)
	})

	suite.Run("ExistsInTeam False - Wrong Team", func() {
		// Create another team
		anotherTeam := suite.DB.Team.Create().
			SetName("another-team").
			SetNamespace("another-namespace").
			SetKubernetesName("another-team-k8s").
			SetKubernetesSecret("another-secret").
			SaveX(suite.Ctx)

		exists, err := suite.deploymentRepo.ExistsInTeam(suite.Ctx, suite.testDeployment.ID, anotherTeam.ID)
		suite.NoError(err)
		suite.False(exists)
	})

	suite.Run("ExistsInTeam False - Non-existent Deployment", func() {
		nonExistentID := uuid.New()
		exists, err := suite.deploymentRepo.ExistsInTeam(suite.Ctx, nonExistentID, suite.testTeam.ID)
		suite.NoError(err)
		suite.False(exists)
	})

	suite.Run("ExistsInTeam Error when DB closed", func() {
		suite.DB.Close()
		exists, err := suite.deploymentRepo.ExistsInTeam(suite.Ctx, suite.testDeployment.ID, suite.testTeam.ID)
		suite.Error(err)
		suite.False(exists)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *DeploymentQueriesSuite) TestGetLastSuccessfulDeployment() {
	suite.Run("GetLastSuccessfulDeployment Success", func() {
		// Create a successful deployment
		successfulDeployment := suite.DB.Deployment.Create().
			SetServiceID(suite.testService.ID).
			SetCommitSha("def456").
			SetCommitMessage("Successful commit").
			SetCommitAuthor(&schema.GitCommitter{Name: "Test User"}).
			SetSource(schema.DeploymentSourceGit).
			SetStatus(schema.DeploymentStatusBuildSucceeded).
			SetBuilder(schema.ServiceBuilderDocker).
			SetQueuedAt(time.Now().Add(-2 * time.Hour)).
			SetStartedAt(time.Now().Add(-90 * time.Minute)).
			SetCompletedAt(time.Now().Add(-time.Hour)).
			SaveX(suite.Ctx)

		deployment, err := suite.deploymentRepo.GetLastSuccessfulDeployment(suite.Ctx, suite.testService.ID)
		suite.NoError(err)
		suite.NotNil(deployment)
		suite.Equal(successfulDeployment.ID, deployment.ID)
		suite.Equal("def456", *deployment.CommitSha)
		suite.Equal(schema.DeploymentStatusBuildSucceeded, deployment.Status)
	})

	suite.Run("GetLastSuccessfulDeployment No Successful Deployments", func() {
		// Create a new service with no successful deployments
		newService := suite.DB.Service.Create().
			SetName("new-service").
			SetType(schema.ServiceTypeDockerimage).
			SetEnvironmentID(suite.testEnvironment.ID).
			SetKubernetesSecret("test-secret").
			SetKubernetesName("new-service-k8s").
			SaveX(suite.Ctx)

		deployment, err := suite.deploymentRepo.GetLastSuccessfulDeployment(suite.Ctx, newService.ID)
		suite.Error(err)
		suite.Nil(deployment)
	})

	suite.Run("GetLastSuccessfulDeployment Returns Most Recent", func() {
		// Create multiple successful deployments
		olderDeployment := suite.DB.Deployment.Create().
			SetServiceID(suite.testService.ID).
			SetCommitSha("older123").
			SetCommitMessage("Older successful commit").
			SetCommitAuthor(&schema.GitCommitter{Name: "Test User"}).
			SetSource(schema.DeploymentSourceGit).
			SetStatus(schema.DeploymentStatusBuildSucceeded).
			SetQueuedAt(time.Now().Add(-4 * time.Hour)).
			SetStartedAt(time.Now().Add(-210 * time.Minute)).
			SetBuilder(schema.ServiceBuilderDocker).
			SetCompletedAt(time.Now().Add(-3 * time.Hour)).
			SaveX(suite.Ctx)

		newerDeployment := suite.DB.Deployment.Create().
			SetServiceID(suite.testService.ID).
			SetCommitSha("newer456").
			SetCommitMessage("Newer successful commit").
			SetCommitAuthor(&schema.GitCommitter{Name: "Test User"}).
			SetSource(schema.DeploymentSourceGit).
			SetStatus(schema.DeploymentStatusBuildSucceeded).
			SetQueuedAt(time.Now().Add(-30 * time.Minute)).
			SetStartedAt(time.Now().Add(-25 * time.Minute)).
			SetCompletedAt(time.Now().Add(-20 * time.Minute)).
			SetBuilder(schema.ServiceBuilderDocker).
			SaveX(suite.Ctx)

		deployment, err := suite.deploymentRepo.GetLastSuccessfulDeployment(suite.Ctx, suite.testService.ID)
		suite.NoError(err)
		suite.NotNil(deployment)
		suite.Equal(newerDeployment.ID, deployment.ID)
		suite.Equal("newer456", *deployment.CommitSha)

		// Ensure it's not the older one
		suite.NotEqual(olderDeployment.ID, deployment.ID)
	})

	suite.Run("GetLastSuccessfulDeployment Error when DB closed", func() {
		suite.DB.Close()
		deployment, err := suite.deploymentRepo.GetLastSuccessfulDeployment(suite.Ctx, suite.testService.ID)
		suite.Error(err)
		suite.Nil(deployment)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *DeploymentQueriesSuite) TestGetJobsByStatus() {
	suite.Run("GetJobsByStatus Success", func() {
		// Create deployments with different statuses
		suite.DB.Deployment.Create().
			SetServiceID(suite.testService.ID).
			SetCommitSha("queued123").
			SetCommitMessage("Queued commit").
			SetCommitAuthor(&schema.GitCommitter{Name: "Test User"}).
			SetSource(schema.DeploymentSourceGit).
			SetStatus(schema.DeploymentStatusBuildQueued).
			SetBuilder(schema.ServiceBuilderDocker).
			SetQueuedAt(time.Now()).
			SaveX(suite.Ctx)

		runningDeployment := suite.DB.Deployment.Create().
			SetServiceID(suite.testService.ID).
			SetCommitSha("running456").
			SetCommitMessage("Running commit").
			SetCommitAuthor(&schema.GitCommitter{Name: "Test User"}).
			SetSource(schema.DeploymentSourceGit).
			SetStatus(schema.DeploymentStatusBuildRunning).
			SetQueuedAt(time.Now().Add(-time.Minute)).
			SetBuilder(schema.ServiceBuilderDocker).
			SetStartedAt(time.Now()).
			SaveX(suite.Ctx)

		// Get queued deployments
		queuedJobs, err := suite.deploymentRepo.GetJobsByStatus(suite.Ctx, schema.DeploymentStatusBuildQueued)
		suite.NoError(err)
		suite.Len(queuedJobs, 2) // Original test deployment + new queued deployment

		// Verify all returned deployments have the correct status
		for _, job := range queuedJobs {
			suite.Equal(schema.DeploymentStatusBuildQueued, job.Status)
		}

		// Get running deployments
		runningJobs, err := suite.deploymentRepo.GetJobsByStatus(suite.Ctx, schema.DeploymentStatusBuildRunning)
		suite.NoError(err)
		suite.Len(runningJobs, 1)
		suite.Equal(runningDeployment.ID, runningJobs[0].ID)
	})

	suite.Run("GetJobsByStatus No Jobs", func() {
		jobs, err := suite.deploymentRepo.GetJobsByStatus(suite.Ctx, schema.DeploymentStatusBuildCancelled)
		suite.NoError(err)
		suite.Len(jobs, 0)
	})

	suite.Run("GetJobsByStatus Error when DB closed", func() {
		suite.DB.Close()
		jobs, err := suite.deploymentRepo.GetJobsByStatus(suite.Ctx, schema.DeploymentStatusBuildQueued)
		suite.Error(err)
		suite.Nil(jobs)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *DeploymentQueriesSuite) TestGetByServiceIDPaginated() {
	// Create multiple deployments for pagination testing
	deployments := make([]*ent.Deployment, 5)
	baseTime := time.Now().Add(-5 * time.Hour)

	for i := 0; i < 5; i++ {
		deployments[i] = suite.DB.Deployment.Create().
			SetServiceID(suite.testService.ID).
			SetCommitSha(fmt.Sprintf("commit%d", i)).
			SetCommitMessage(fmt.Sprintf("Commit message %d", i)).
			SetCommitAuthor(&schema.GitCommitter{Name: "Test User"}).
			SetSource(schema.DeploymentSourceGit).
			SetStatus(schema.DeploymentStatusBuildQueued).
			SetQueuedAt(baseTime.Add(time.Duration(i) * time.Hour)).
			SetCreatedAt(baseTime.Add(time.Duration(i) * time.Hour)).
			SetBuilder(schema.ServiceBuilderDocker).
			SaveX(suite.Ctx)
	}

	suite.Run("GetByServiceIDPaginated First Page", func() {
		jobs, nextCursor, err := suite.deploymentRepo.GetByServiceIDPaginated(suite.Ctx, suite.testService.ID, 3, nil, nil)
		suite.NoError(err)
		suite.Len(jobs, 3)
		suite.NotNil(nextCursor)

		// Should be ordered by created_at DESC (most recent first)
		suite.True(jobs[0].CreatedAt.After(jobs[1].CreatedAt))
		suite.True(jobs[1].CreatedAt.After(jobs[2].CreatedAt))
	})

	suite.Run("GetByServiceIDPaginated Second Page", func() {
		// Get first page to get cursor
		_, firstCursor, err := suite.deploymentRepo.GetByServiceIDPaginated(suite.Ctx, suite.testService.ID, 3, nil, nil)
		suite.NoError(err)
		suite.NotNil(firstCursor)

		// Get second page
		jobs, nextCursor, err := suite.deploymentRepo.GetByServiceIDPaginated(suite.Ctx, suite.testService.ID, 3, firstCursor, nil)
		suite.NoError(err)
		suite.Len(jobs, 2)    // Should have 2 more ( 5 total, 3 on first page, 2 on second page)
		suite.Nil(nextCursor) // No more pages
	})

	suite.Run("GetByServiceIDPaginated With Status Filter", func() {
		// Create a deployment with different status
		suite.DB.Deployment.Create().
			SetServiceID(suite.testService.ID).
			SetCommitSha("filtered123").
			SetCommitMessage("Filtered commit").
			SetCommitAuthor(&schema.GitCommitter{Name: "Test User"}).
			SetSource(schema.DeploymentSourceGit).
			SetStatus(schema.DeploymentStatusBuildSucceeded).
			SetQueuedAt(time.Now()).
			SetBuilder(schema.ServiceBuilderDocker).
			SaveX(suite.Ctx)

		statusFilter := []schema.DeploymentStatus{schema.DeploymentStatusBuildQueued}
		jobs, _, err := suite.deploymentRepo.GetByServiceIDPaginated(suite.Ctx, suite.testService.ID, 10, nil, statusFilter)
		suite.NoError(err)

		// All returned jobs should have the filtered status
		for _, job := range jobs {
			suite.Equal(schema.DeploymentStatusBuildQueued, job.Status)
		}
	})

	suite.Run("GetByServiceIDPaginated Empty Result", func() {
		newService := suite.DB.Service.Create().
			SetName("empty-service").
			SetType(schema.ServiceTypeDockerimage).
			SetEnvironmentID(suite.testEnvironment.ID).
			SetKubernetesSecret("test-secret").
			SetKubernetesName("empty-service-k8s").
			SaveX(suite.Ctx)

		jobs, nextCursor, err := suite.deploymentRepo.GetByServiceIDPaginated(suite.Ctx, newService.ID, 10, nil, nil)
		suite.NoError(err)
		suite.Len(jobs, 0)
		suite.Nil(nextCursor)
	})

	suite.Run("GetByServiceIDPaginated Error when DB closed", func() {
		suite.DB.Close()
		jobs, nextCursor, err := suite.deploymentRepo.GetByServiceIDPaginated(suite.Ctx, suite.testService.ID, 10, nil, nil)
		suite.Error(err)
		suite.Nil(jobs)
		suite.Nil(nextCursor)
		suite.ErrorContains(err, "database is closed")
	})
}

func TestDeploymentQueriesSuite(t *testing.T) {
	suite.Run(t, new(DeploymentQueriesSuite))
}
