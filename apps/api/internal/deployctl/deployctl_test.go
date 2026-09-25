package deployctl

import (
	"context"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/config"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/infrastructure/k8s"
	"github.com/unbindapp/unbind-api/internal/infrastructure/queue"
	variables_service "github.com/unbindapp/unbind-api/internal/services/variables"
	"github.com/unbindapp/unbind-api/internal/vartemplate"
	k8s_mocks "github.com/unbindapp/unbind-api/mocks/infrastructure/k8s"
	github_mocks "github.com/unbindapp/unbind-api/mocks/integrations/github"
	repo_mocks "github.com/unbindapp/unbind-api/mocks/repositories"
	deployment_mocks "github.com/unbindapp/unbind-api/mocks/repository/deployment"
	service_mocks "github.com/unbindapp/unbind-api/mocks/repository/service"
	system_mocks "github.com/unbindapp/unbind-api/mocks/repository/system"
	variables_mocks "github.com/unbindapp/unbind-api/mocks/services/variables"
	webhooks_mocks "github.com/unbindapp/unbind-api/mocks/services/webhooks"
)

// Test suite for DeploymentController
type DeploymentControllerTestSuite struct {
	suite.Suite
	ctx                  context.Context
	cancel               context.CancelFunc
	config               *config.Config
	miniRedis            *miniredis.Miniredis
	redisClient          *redis.Client
	k8sMock              *k8s_mocks.KubeClientMock
	githubMock           *github_mocks.GithubClientMock
	repoMock             *repo_mocks.RepositoriesMock
	webhooksMock         *webhooks_mocks.WebhooksServiceMock
	variablesMock        *variables_mocks.VariablesServiceMock
	deploymentController *DeploymentController
}

func (suite *DeploymentControllerTestSuite) SetupTest() {
	suite.ctx, suite.cancel = context.WithCancel(context.Background())

	// Setup config
	suite.config = &config.Config{
		ExternalUIUrl:   "https://ui.example.com",
		SystemNamespace: "unbind-system",
	}

	// Setup miniredis
	var err error
	suite.miniRedis, err = miniredis.Run()
	suite.Require().NoError(err)

	// Setup Redis client
	suite.redisClient = redis.NewClient(&redis.Options{
		Addr: suite.miniRedis.Addr(),
	})

	// Setup mocks
	suite.k8sMock = &k8s_mocks.KubeClientMock{}
	suite.githubMock = &github_mocks.GithubClientMock{}
	suite.repoMock = &repo_mocks.RepositoriesMock{}
	suite.webhooksMock = &webhooks_mocks.WebhooksServiceMock{}
	suite.variablesMock = &variables_mocks.VariablesServiceMock{}

	// Create deployment controller
	suite.deploymentController = NewDeploymentController(
		suite.ctx,
		suite.cancel,
		suite.config,
		suite.k8sMock,
		suite.redisClient,
		suite.repoMock,
		suite.githubMock,
		suite.webhooksMock,
		suite.variablesMock,
	)
}

func (suite *DeploymentControllerTestSuite) TearDownTest() {
	suite.cancel()
	suite.miniRedis.Close()
	suite.redisClient.Close()
}

func (suite *DeploymentControllerTestSuite) TestNewDeploymentController() {
	// Verify the controller was created correctly
	assert.NotNil(suite.T(), suite.deploymentController)
	assert.Equal(suite.T(), suite.config, suite.deploymentController.cfg)
	assert.Equal(suite.T(), suite.k8sMock, suite.deploymentController.k8s)
	assert.NotNil(suite.T(), suite.deploymentController.jobQueue)
	assert.NotNil(suite.T(), suite.deploymentController.dependentQueue)
}

func (suite *DeploymentControllerTestSuite) TestAreDependenciesReady_NoDependencies() {
	serviceID := uuid.New()
	req := DeploymentJobRequest{
		ServiceID:           serviceID,
		DependsOnServiceIDs: []uuid.UUID{},
	}

	suite.variablesMock.EXPECT().RenderServiceVariables(mock.Anything, serviceID).Return(&variables_service.RenderResult{}, nil)

	ready := suite.deploymentController.AreDependenciesReady(suite.ctx, req)
	suite.Assert().True(ready)
}

func (suite *DeploymentControllerTestSuite) TestAreDependenciesReady_VariableResolutionFailure() {
	serviceID := uuid.New()
	req := DeploymentJobRequest{
		ServiceID:           serviceID,
		DependsOnServiceIDs: []uuid.UUID{},
	}

	suite.variablesMock.EXPECT().RenderServiceVariables(mock.Anything, serviceID).Return(nil, assert.AnError)

	ready := suite.deploymentController.AreDependenciesReady(suite.ctx, req)
	suite.Assert().False(ready)
}

func (suite *DeploymentControllerTestSuite) TestAreDependenciesReady_UnresolvedReference() {
	serviceID := uuid.New()
	req := DeploymentJobRequest{
		ServiceID:           serviceID,
		DependsOnServiceIDs: []uuid.UUID{},
	}

	suite.variablesMock.EXPECT().RenderServiceVariables(mock.Anything, serviceID).Return(&variables_service.RenderResult{
		Unresolved: map[string][]vartemplate.Token{"DATABASE_URL": {{Key: "DATABASE_URL"}}},
	}, nil)

	ready := suite.deploymentController.AreDependenciesReady(suite.ctx, req)
	suite.Assert().False(ready)
}

func (suite *DeploymentControllerTestSuite) TestAreDependenciesReady_WithUnhealthyDependencies() {
	serviceID := uuid.New()
	depServiceID := uuid.New()
	req := DeploymentJobRequest{
		ServiceID:           serviceID,
		DependsOnServiceIDs: []uuid.UUID{depServiceID},
	}

	suite.variablesMock.EXPECT().RenderServiceVariables(mock.Anything, serviceID).Return(&variables_service.RenderResult{}, nil)

	// Mock service repo method through the repo mock
	serviceMock := service_mocks.NewServiceRepositoryMock(suite.T())
	serviceMock.EXPECT().GetDeploymentNamespace(mock.Anything, serviceID).Return("test-namespace", nil)
	suite.repoMock.EXPECT().Service().Return(serviceMock)

	suite.k8sMock.EXPECT().GetInternalClient().Return(nil)
	suite.k8sMock.EXPECT().GetSimpleHealthStatus(
		mock.Anything,
		"test-namespace",
		map[string]string{"unbind-service": depServiceID.String()},
		mock.Anything,
		mock.Anything,
	).Return(&k8s.SimpleHealthStatus{Health: k8s.ReplicaHealthCrashing}, nil)

	ready := suite.deploymentController.AreDependenciesReady(suite.ctx, req)
	suite.Assert().False(ready)
}

func (suite *DeploymentControllerTestSuite) TestAreDependenciesReady_WithHealthyDependencies() {
	serviceID := uuid.New()
	depServiceID := uuid.New()
	req := DeploymentJobRequest{
		ServiceID:           serviceID,
		DependsOnServiceIDs: []uuid.UUID{depServiceID},
	}

	suite.variablesMock.EXPECT().RenderServiceVariables(mock.Anything, serviceID).Return(&variables_service.RenderResult{}, nil)

	// Mock service repo method through the repo mock
	serviceMock := service_mocks.NewServiceRepositoryMock(suite.T())
	serviceMock.EXPECT().GetDeploymentNamespace(mock.Anything, serviceID).Return("test-namespace", nil)
	suite.repoMock.EXPECT().Service().Return(serviceMock)

	suite.k8sMock.EXPECT().GetInternalClient().Return(nil)
	suite.k8sMock.EXPECT().GetSimpleHealthStatus(
		mock.Anything,
		"test-namespace",
		map[string]string{"unbind-service": depServiceID.String()},
		mock.Anything,
		mock.Anything,
	).Return(&k8s.SimpleHealthStatus{Health: k8s.ReplicaHealthActive}, nil)

	ready := suite.deploymentController.AreDependenciesReady(suite.ctx, req)
	suite.Assert().True(ready)
}

func (suite *DeploymentControllerTestSuite) TestRedisIntegration() {
	// Test that miniredis is working correctly with the queue
	serviceID := uuid.New()
	req := DeploymentJobRequest{
		ServiceID:     serviceID,
		Source:        schema.DeploymentSourceManual,
		CommitSHA:     "test-commit",
		CommitMessage: "Test message",
		GitBranch:     "main",
		Environment:   map[string]string{"TEST": "value"},
	}

	// Enqueue job
	jobID := uuid.New().String()
	err := suite.deploymentController.jobQueue.Enqueue(suite.ctx, jobID, req)
	suite.Require().NoError(err)

	// Verify job is in queue
	jobs, err := suite.deploymentController.jobQueue.GetAll(suite.ctx)
	suite.Require().NoError(err)
	suite.Assert().Len(jobs, 1)
	suite.Assert().Equal(serviceID, jobs[0].Data.ServiceID)
	suite.Assert().Equal("test-commit", jobs[0].Data.CommitSHA)

	// Remove job
	err = suite.deploymentController.jobQueue.Remove(suite.ctx, jobID)
	suite.Require().NoError(err)

	// Verify job is removed
	jobs, err = suite.deploymentController.jobQueue.GetAll(suite.ctx)
	suite.Require().NoError(err)
	suite.Assert().Len(jobs, 0)
}

func (suite *DeploymentControllerTestSuite) TestStartAsync_QueueProcessors() {
	// Test that StartAsync initializes the queue processors without errors
	// This is a basic test to ensure the async operations start correctly
	suite.k8sMock.EXPECT().CountActiveDeploymentJobs(mock.Anything).Return(0, nil).Maybe()

	// Start the async operations
	suite.deploymentController.StartAsync()

	// Give a brief moment for goroutines to start
	time.Sleep(10 * time.Millisecond)

	// Stop the controller
	suite.deploymentController.Stop()

	// The test passes if no panics occur
	suite.Assert().True(true)
}

func (suite *DeploymentControllerTestSuite) TestJobQueueOperations() {
	// Test basic queue operations
	serviceID1 := uuid.New()
	serviceID2 := uuid.New()

	req1 := DeploymentJobRequest{
		ServiceID:     serviceID1,
		Source:        schema.DeploymentSourceManual,
		CommitSHA:     "commit1",
		CommitMessage: "First commit",
		GitBranch:     "main",
		Environment:   map[string]string{"ENV": "test"},
	}

	req2 := DeploymentJobRequest{
		ServiceID:     serviceID2,
		Source:        schema.DeploymentSourceGit,
		CommitSHA:     "commit2",
		CommitMessage: "Second commit",
		GitBranch:     "develop",
		Environment:   map[string]string{"ENV": "staging"},
	}

	// Test enqueue
	jobID1 := uuid.New().String()
	jobID2 := uuid.New().String()

	err := suite.deploymentController.jobQueue.Enqueue(suite.ctx, jobID1, req1)
	suite.Require().NoError(err)

	err = suite.deploymentController.dependentQueue.Enqueue(suite.ctx, jobID2, req2)
	suite.Require().NoError(err)

	// Test get all jobs
	mainJobs, err := suite.deploymentController.jobQueue.GetAll(suite.ctx)
	suite.Require().NoError(err)
	suite.Assert().Len(mainJobs, 1)
	suite.Assert().Equal(serviceID1, mainJobs[0].Data.ServiceID)

	depJobs, err := suite.deploymentController.dependentQueue.GetAll(suite.ctx)
	suite.Require().NoError(err)
	suite.Assert().Len(depJobs, 1)
	suite.Assert().Equal(serviceID2, depJobs[0].Data.ServiceID)

	// Test removing jobs
	err = suite.deploymentController.jobQueue.Remove(suite.ctx, jobID1)
	suite.Require().NoError(err)

	err = suite.deploymentController.dependentQueue.Remove(suite.ctx, jobID2)
	suite.Require().NoError(err)

	// Verify removal
	mainJobs, err = suite.deploymentController.jobQueue.GetAll(suite.ctx)
	suite.Require().NoError(err)
	suite.Assert().Len(mainJobs, 0)

	depJobs, err = suite.deploymentController.dependentQueue.GetAll(suite.ctx)
	suite.Require().NoError(err)
	suite.Assert().Len(depJobs, 0)
}

func (suite *DeploymentControllerTestSuite) enqueueBuild(commitSHA string) map[string]string {
	serviceID := uuid.New()
	deploymentRepo := &deployment_mocks.DeploymentRepositoryMock{}
	systemRepo := &system_mocks.SystemRepositoryMock{}
	serviceRepo := &service_mocks.ServiceRepositoryMock{}
	suite.repoMock.EXPECT().Deployment().Return(deploymentRepo)
	suite.repoMock.EXPECT().System().Return(systemRepo)
	suite.repoMock.EXPECT().Service().Return(serviceRepo).Maybe()
	serviceRepo.EXPECT().GetByID(mock.Anything, serviceID).Return(nil, assert.AnError).Maybe()
	deploymentRepo.EXPECT().Create(mock.Anything, mock.Anything, serviceID, commitSHA, mock.Anything, mock.Anything, mock.Anything, mock.Anything, schema.DeploymentStatusBuildQueued).
		Return(&ent.Deployment{ID: uuid.New()}, nil)
	suite.variablesMock.EXPECT().RenderServiceVariables(mock.Anything, serviceID).Return(&variables_service.RenderResult{}, nil)
	systemRepo.EXPECT().GetDefaultRegistry(mock.Anything).Return(&ent.Registry{Host: "registry.local", KubernetesSecret: "registry"}, nil)
	systemRepo.EXPECT().GetImagePullSecrets(mock.Anything).Return(nil, nil)
	suite.k8sMock.EXPECT().GetInternalClient().Return(nil)
	suite.k8sMock.EXPECT().GetSecret(mock.Anything, "registry", "unbind-system", mock.Anything).Return(nil, nil)
	suite.k8sMock.EXPECT().ParseRegistryCredentials(mock.Anything).Return("user", "pass", nil)

	_, err := suite.deploymentController.EnqueueDeploymentJob(suite.ctx, DeploymentJobRequest{
		ServiceID:   serviceID,
		Source:      schema.DeploymentSourceGit,
		CommitSHA:   commitSHA,
		Environment: map[string]string{},
	})
	suite.Require().NoError(err)

	jobs, err := suite.deploymentController.jobQueue.GetAll(suite.ctx)
	suite.Require().NoError(err)
	suite.Require().Len(jobs, 1)
	return jobs[0].Data.Environment
}

func (suite *DeploymentControllerTestSuite) TestEnqueueDeploymentJobPinsCommit() {
	env := suite.enqueueBuild("0123456789abcdef0123456789abcdef01234567")
	suite.Equal("0123456789abcdef0123456789abcdef01234567", env["CHECKOUT_COMMIT_SHA"])
}

func (suite *DeploymentControllerTestSuite) TestEnqueueDeploymentJobWithoutCommitClonesRef() {
	env := suite.enqueueBuild("")
	suite.NotContains(env, "CHECKOUT_COMMIT_SHA")
}

func (suite *DeploymentControllerTestSuite) queuedBuild(serviceID uuid.UUID) (*queue.QueueItem[DeploymentJobRequest], *deployment_mocks.DeploymentRepositoryMock) {
	jobID := uuid.New()
	deploymentRepo := &deployment_mocks.DeploymentRepositoryMock{}
	suite.repoMock.EXPECT().Deployment().Return(deploymentRepo)
	deploymentRepo.EXPECT().MarkCancelledExcept(mock.Anything, serviceID, jobID).Return(nil)
	suite.k8sMock.EXPECT().CancelJobsByServiceID(mock.Anything, serviceID.String()).Return(nil)

	return &queue.QueueItem[DeploymentJobRequest]{
		ID:         jobID.String(),
		Data:       DeploymentJobRequest{ServiceID: serviceID, Environment: map[string]string{}},
		EnqueuedAt: time.Now().Add(-time.Minute),
	}, deploymentRepo
}

func (suite *DeploymentControllerTestSuite) TestProcessJobRequeuesWhileCancelledBuildStops() {
	serviceID := uuid.New()
	item, _ := suite.queuedBuild(serviceID)
	suite.k8sMock.EXPECT().ServiceBuildStopping(mock.Anything, serviceID.String(), cancelledBuildStopGrace).Return(true, nil)
	suite.Require().NoError(suite.deploymentController.jobQueue.Enqueue(suite.ctx, uuid.NewString(), DeploymentJobRequest{ServiceID: uuid.New()}))

	suite.Require().NoError(suite.deploymentController.processJob(suite.ctx, item))

	jobs, err := suite.deploymentController.jobQueue.GetAll(suite.ctx)
	suite.Require().NoError(err)
	suite.Require().Len(jobs, 2)
	suite.Equal(item.ID, jobs[0].ID, "the requeued build keeps its place ahead of later ones")
}

func (suite *DeploymentControllerTestSuite) TestProcessJobStartsOnceCancelledBuildIsGone() {
	serviceID := uuid.New()
	item, deploymentRepo := suite.queuedBuild(serviceID)
	jobID := uuid.MustParse(item.ID)
	suite.k8sMock.EXPECT().ServiceBuildStopping(mock.Anything, serviceID.String(), cancelledBuildStopGrace).Return(false, nil)
	deploymentRepo.EXPECT().MarkStarted(mock.Anything, mock.Anything, jobID, mock.Anything).Return(&ent.Deployment{ID: jobID}, nil)
	suite.k8sMock.EXPECT().CreateDeployment(mock.Anything, item.ID, serviceID.String(), item.Data.Environment).Return("build-job", nil)
	deploymentRepo.EXPECT().AssignKubernetesJobName(mock.Anything, jobID, "build-job").Return(&ent.Deployment{ID: jobID}, nil)

	suite.Require().NoError(suite.deploymentController.processJob(suite.ctx, item))

	jobs, err := suite.deploymentController.jobQueue.GetAll(suite.ctx)
	suite.Require().NoError(err)
	suite.Empty(jobs)
}

func TestDeploymentControllerSuite(t *testing.T) {
	suite.Run(t, new(DeploymentControllerTestSuite))
}
