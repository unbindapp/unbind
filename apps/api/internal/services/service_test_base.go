package services

import (
	"context"

	"github.com/stretchr/testify/suite"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	mocks_deployctl "github.com/unbindapp/unbind-api/mocks/deployctl"
	mocks_infrastructure_k8s "github.com/unbindapp/unbind-api/mocks/infrastructure/k8s"
	mocks_repositories "github.com/unbindapp/unbind-api/mocks/repositories"
	mocks_repository_bootstrap "github.com/unbindapp/unbind-api/mocks/repository/bootstrap"
	mocks_repository_deployment "github.com/unbindapp/unbind-api/mocks/repository/deployment"
	mocks_repository_environment "github.com/unbindapp/unbind-api/mocks/repository/environment"
	mocks_repository_github "github.com/unbindapp/unbind-api/mocks/repository/github"
	mocks_repository_group "github.com/unbindapp/unbind-api/mocks/repository/group"
	mocks_repository_oauth "github.com/unbindapp/unbind-api/mocks/repository/oauth"
	mocks_repository_permissions "github.com/unbindapp/unbind-api/mocks/repository/permissions"
	mocks_repository_project "github.com/unbindapp/unbind-api/mocks/repository/project"
	mocks_repository_s3 "github.com/unbindapp/unbind-api/mocks/repository/s3"
	mocks_repository_service "github.com/unbindapp/unbind-api/mocks/repository/service"
	mocks_repository_system "github.com/unbindapp/unbind-api/mocks/repository/system"
	mocks_repository_team "github.com/unbindapp/unbind-api/mocks/repository/team"
	mocks_repository_tx "github.com/unbindapp/unbind-api/mocks/repository/tx"
	mocks_repository_user "github.com/unbindapp/unbind-api/mocks/repository/user"
	mocks_repository_webhook "github.com/unbindapp/unbind-api/mocks/repository/webhook"
)

// ServiceTestSuite provides a reusable base for service tests with all common mocks set up
// Embed this in your service test suites to avoid mock setup duplication
type ServiceTestSuite struct {
	suite.Suite
	Ctx context.Context

	// Main repository mock
	MockRepo *mocks_repositories.RepositoriesMock

	// Individual repository mocks
	MockPermissionsRepo *mocks_repository_permissions.PermissionsRepositoryMock
	MockProjectRepo     *mocks_repository_project.ProjectRepositoryMock
	MockEnvironmentRepo *mocks_repository_environment.EnvironmentRepositoryMock
	MockServiceRepo     *mocks_repository_service.ServiceRepositoryMock
	MockDeploymentRepo  *mocks_repository_deployment.DeploymentRepositoryMock
	MockTeamRepo        *mocks_repository_team.TeamRepositoryMock
	MockUserRepo        *mocks_repository_user.UserRepositoryMock
	MockGithubRepo      *mocks_repository_github.GithubRepositoryMock
	MockWebhookRepo     *mocks_repository_webhook.WebhookRepositoryMock
	MockSystemRepo      *mocks_repository_system.SystemRepositoryMock
	MockS3Repo          *mocks_repository_s3.S3RepositoryMock
	MockOauthRepo       *mocks_repository_oauth.OauthRepositoryMock
	MockGroupRepo       *mocks_repository_group.GroupRepositoryMock
	MockBootstrapRepo   *mocks_repository_bootstrap.BootstrapRepositoryMock

	// Infrastructure mocks
	MockK8s       *mocks_infrastructure_k8s.KubeClientMock
	MockDeployCtl *mocks_deployctl.DeploymentControllerMock
}

func (suite *ServiceTestSuite) SetupTest() {
	suite.Ctx = context.Background()

	// Initialize main repository mock
	suite.MockRepo = mocks_repositories.NewRepositoriesMock(suite.T())

	// Initialize individual repository mocks
	suite.MockPermissionsRepo = mocks_repository_permissions.NewPermissionsRepositoryMock(suite.T())
	suite.MockProjectRepo = mocks_repository_project.NewProjectRepositoryMock(suite.T())
	suite.MockEnvironmentRepo = mocks_repository_environment.NewEnvironmentRepositoryMock(suite.T())
	suite.MockServiceRepo = mocks_repository_service.NewServiceRepositoryMock(suite.T())
	suite.MockDeploymentRepo = mocks_repository_deployment.NewDeploymentRepositoryMock(suite.T())
	suite.MockTeamRepo = mocks_repository_team.NewTeamRepositoryMock(suite.T())
	suite.MockUserRepo = mocks_repository_user.NewUserRepositoryMock(suite.T())
	suite.MockGithubRepo = mocks_repository_github.NewGithubRepositoryMock(suite.T())
	suite.MockWebhookRepo = mocks_repository_webhook.NewWebhookRepositoryMock(suite.T())
	suite.MockSystemRepo = mocks_repository_system.NewSystemRepositoryMock(suite.T())
	suite.MockS3Repo = mocks_repository_s3.NewS3RepositoryMock(suite.T())
	suite.MockOauthRepo = mocks_repository_oauth.NewOauthRepositoryMock(suite.T())
	suite.MockGroupRepo = mocks_repository_group.NewGroupRepositoryMock(suite.T())
	suite.MockBootstrapRepo = mocks_repository_bootstrap.NewBootstrapRepositoryMock(suite.T())

	// Initialize infrastructure mocks
	suite.MockK8s = mocks_infrastructure_k8s.NewKubeClientMock(suite.T())
	suite.MockDeployCtl = mocks_deployctl.NewDeploymentControllerMock(suite.T())

	// Setup repository relationships - use Maybe() to avoid strict expectations for unused repos
	suite.MockRepo.EXPECT().Permissions().Return(suite.MockPermissionsRepo).Maybe()
	suite.MockRepo.EXPECT().Project().Return(suite.MockProjectRepo).Maybe()
	suite.MockRepo.EXPECT().Environment().Return(suite.MockEnvironmentRepo).Maybe()
	suite.MockRepo.EXPECT().Service().Return(suite.MockServiceRepo).Maybe()
	suite.MockRepo.EXPECT().Deployment().Return(suite.MockDeploymentRepo).Maybe()
	suite.MockRepo.EXPECT().Team().Return(suite.MockTeamRepo).Maybe()
	suite.MockRepo.EXPECT().User().Return(suite.MockUserRepo).Maybe()
	suite.MockRepo.EXPECT().Github().Return(suite.MockGithubRepo).Maybe()
	suite.MockRepo.EXPECT().Webhooks().Return(suite.MockWebhookRepo).Maybe()
	suite.MockRepo.EXPECT().System().Return(suite.MockSystemRepo).Maybe()
	suite.MockRepo.EXPECT().S3().Return(suite.MockS3Repo).Maybe()
	suite.MockRepo.EXPECT().Oauth().Return(suite.MockOauthRepo).Maybe()
	suite.MockRepo.EXPECT().Group().Return(suite.MockGroupRepo).Maybe()
	suite.MockRepo.EXPECT().Bootstrap().Return(suite.MockBootstrapRepo).Maybe()
}

func (suite *ServiceTestSuite) TearDownTest() {
	// Assert expectations on all mocks
	suite.MockRepo.AssertExpectations(suite.T())
	suite.MockPermissionsRepo.AssertExpectations(suite.T())
	suite.MockProjectRepo.AssertExpectations(suite.T())
	suite.MockEnvironmentRepo.AssertExpectations(suite.T())
	suite.MockServiceRepo.AssertExpectations(suite.T())
	suite.MockDeploymentRepo.AssertExpectations(suite.T())
	suite.MockTeamRepo.AssertExpectations(suite.T())
	suite.MockUserRepo.AssertExpectations(suite.T())
	suite.MockGithubRepo.AssertExpectations(suite.T())
	suite.MockWebhookRepo.AssertExpectations(suite.T())
	suite.MockSystemRepo.AssertExpectations(suite.T())
	suite.MockS3Repo.AssertExpectations(suite.T())
	suite.MockOauthRepo.AssertExpectations(suite.T())
	suite.MockGroupRepo.AssertExpectations(suite.T())
	suite.MockBootstrapRepo.AssertExpectations(suite.T())
	suite.MockK8s.AssertExpectations(suite.T())
	suite.MockDeployCtl.AssertExpectations(suite.T())
}

// NewTxMock creates a new transaction mock for use in WithTx calls
func (suite *ServiceTestSuite) NewTxMock() repository.TxInterface {
	return mocks_repository_tx.NewTxMock(suite.T())
}

// Helper method to get a properly typed transaction mock
func (suite *ServiceTestSuite) NewTxMockTyped() *mocks_repository_tx.TxMock {
	return mocks_repository_tx.NewTxMock(suite.T())
}
