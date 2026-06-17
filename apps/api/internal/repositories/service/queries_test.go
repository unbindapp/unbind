package service_repo

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/githubinstallation"
	"github.com/unbindapp/unbind-api/ent/schema"
	entService "github.com/unbindapp/unbind-api/ent/service"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	"github.com/unbindapp/unbind-api/internal/models"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	deployment_repo "github.com/unbindapp/unbind-api/internal/repositories/deployment"
	v1 "github.com/unbindapp/unbind-operator/api/v1"
	"golang.org/x/crypto/bcrypt"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type ServiceQueriesSuite struct {
	repository.RepositoryBaseSuite
	serviceRepo            *ServiceRepository
	deploymentRepo         *deployment_repo.DeploymentRepository
	testUser               *ent.User
	testTeam               *ent.Team
	testProject            *ent.Project
	testEnvironment        *ent.Environment
	testService            *ent.Service
	testConfig             *ent.ServiceConfig
	testDeployment         *ent.Deployment
	testGithubApp          *ent.GithubApp
	testGithubInstallation *ent.GithubInstallation
}

func (suite *ServiceQueriesSuite) SetupTest() {
	suite.RepositoryBaseSuite.SetupTest()
	suite.deploymentRepo = deployment_repo.NewDeploymentRepository(suite.DB)
	suite.serviceRepo = NewServiceRepository(suite.DB, suite.deploymentRepo)

	// Create test user
	pwd, _ := bcrypt.GenerateFromPassword([]byte("test-password"), 1)
	suite.testUser = suite.DB.User.Create().
		SetEmail("test@example.com").
		SetPasswordHash(string(pwd)).
		SaveX(suite.Ctx)

	// Create test team
	suite.testTeam = suite.DB.Team.Create().
		SetKubernetesName("test-team").
		SetName("Test Team").
		SetDescription("Test team description").
		SetNamespace("test-namespace").
		SetKubernetesSecret("test-k8s-secret").
		SaveX(suite.Ctx)

	// Create test project
	suite.testProject = suite.DB.Project.Create().
		SetKubernetesName("test-project").
		SetName("Test Project").
		SetDescription("Test project description").
		SetTeamID(suite.testTeam.ID).
		SetKubernetesSecret("test-project-secret").
		SaveX(suite.Ctx)

	// Create test environment
	suite.testEnvironment = suite.DB.Environment.Create().
		SetKubernetesName("test-env").
		SetName("Test Environment").
		SetDescription("Test environment").
		SetProjectID(suite.testProject.ID).
		SetKubernetesSecret("test-env-secret").
		SaveX(suite.Ctx)

	// Create test GitHub app
	suite.testGithubApp = suite.DB.GithubApp.Create().
		SetID(12345).
		SetUUID(uuid.New()).
		SetClientID("test-client-id").
		SetClientSecret("test-client-secret").
		SetWebhookSecret("test-webhook-secret").
		SetPrivateKey("test-private-key").
		SetName("Test App").
		SetCreatedBy(suite.testUser.ID).
		SaveX(suite.Ctx)

	// Create test installation
	suite.testGithubInstallation = suite.DB.GithubInstallation.Create().
		SetID(67890).
		SetGithubAppID(suite.testGithubApp.ID).
		SetAccountID(11111).
		SetAccountLogin("test-org").
		SetAccountType(githubinstallation.AccountTypeOrganization).
		SetAccountURL("https://github.com/test-org").
		SetRepositorySelection(githubinstallation.RepositorySelectionSelected).
		SetSuspended(false).
		SetActive(true).
		SetPermissions(schema.GithubInstallationPermissions{
			Contents: "read",
			Metadata: "read",
		}).
		SetEvents([]string{"push", "pull_request"}).
		SaveX(suite.Ctx)

	// Create test service
	suite.testService = suite.DB.Service.Create().
		SetType(schema.ServiceTypeGithub).
		SetKubernetesName("test-service").
		SetName("Test Service").
		SetDescription("Test service description").
		SetEnvironmentID(suite.testEnvironment.ID).
		SetKubernetesSecret("test-service-secret").
		SetGithubInstallationID(suite.testGithubInstallation.ID).
		SetGitRepository("test-repo").
		SetGitRepositoryOwner("test-org").
		SetDetectedPorts([]schema.PortSpec{
			{Port: 3000, Protocol: utils.ToPtr(schema.ProtocolTCP)},
		}).
		SaveX(suite.Ctx)

	// Create test service config
	builder := schema.ServiceBuilderRailpack
	suite.testConfig = suite.DB.ServiceConfig.Create().
		SetServiceID(suite.testService.ID).
		SetBuilder(builder).
		SetIcon("nodejs").
		SetReplicas(1).
		SetAutoDeploy(true).
		SetIsPublic(false).
		SetPorts([]schema.PortSpec{
			{Port: 3000, Protocol: utils.ToPtr(schema.ProtocolTCP)},
		}).
		SetHosts([]schema.HostSpec{
			{Host: "example.com", TargetPort: utils.ToPtr(int32(3000))},
		}).
		SaveX(suite.Ctx)

	// Create test deployment
	suite.testDeployment = suite.DB.Deployment.Create().
		SetServiceID(suite.testService.ID).
		SetStatus(schema.DeploymentStatusBuildSucceeded).
		SetSource(schema.DeploymentSourceManual).
		SetCommitSha("abc123").
		SetCommitMessage("Initial commit").
		SetBuilder(schema.ServiceBuilderDocker).
		SetCommitAuthor(&schema.GitCommitter{
			Name:      "Test User",
			AvatarURL: "https://github.com/test.png",
		}).
		SetResourceDefinition(&v1.Service{
			TypeMeta: metav1.TypeMeta{
				Kind:       "Service",
				APIVersion: "unbind.app/v1",
			},
			Spec: v1.ServiceSpec{
				Builder: "railpack",
				Config: v1.ServiceConfigSpec{
					GitBranch: "refs/heads/main",
					Hosts: []v1.HostSpec{
						{Host: "example.com", Port: utils.ToPtr(int32(3000))},
					},
					Replicas: utils.ToPtr[int32](1),
					Ports: []v1.PortSpec{
						{Port: 3000, Protocol: utils.ToPtr(corev1.ProtocolTCP)},
					},
					Public: false,
				},
			},
		}).
		SaveX(suite.Ctx)

	// Set current deployment
	suite.testService = suite.DB.Service.UpdateOneID(suite.testService.ID).
		SetCurrentDeploymentID(suite.testDeployment.ID).
		SaveX(suite.Ctx)
}

func (suite *ServiceQueriesSuite) TearDownTest() {
	suite.RepositoryBaseSuite.TearDownTest()
	suite.serviceRepo = nil
	suite.deploymentRepo = nil
	suite.testUser = nil
	suite.testTeam = nil
	suite.testProject = nil
	suite.testEnvironment = nil
	suite.testService = nil
	suite.testConfig = nil
	suite.testDeployment = nil
	suite.testGithubApp = nil
	suite.testGithubInstallation = nil
}

func (suite *ServiceQueriesSuite) TestGetByID() {
	suite.Run("GetByID Success", func() {
		service, err := suite.serviceRepo.GetByID(suite.Ctx, suite.testService.ID)
		suite.NoError(err)
		suite.NotNil(service)
		suite.Equal(suite.testService.ID, service.ID)
		suite.Equal("Test Service", service.Name)
		suite.Equal(schema.ServiceTypeGithub, service.Type)

		// Check edges are loaded
		suite.NotNil(service.Edges.Environment)
		suite.Equal(suite.testEnvironment.ID, service.Edges.Environment.ID)
		suite.NotNil(service.Edges.Environment.Edges.Project)
		suite.Equal(suite.testProject.ID, service.Edges.Environment.Edges.Project.ID)
		suite.NotNil(service.Edges.Environment.Edges.Project.Edges.Team)
		suite.Equal(suite.testTeam.ID, service.Edges.Environment.Edges.Project.Edges.Team.ID)

		suite.NotNil(service.Edges.ServiceConfig)
		suite.Equal(suite.testConfig.ID, service.Edges.ServiceConfig.ID)

		suite.NotNil(service.Edges.CurrentDeployment)
		suite.Equal(suite.testDeployment.ID, service.Edges.CurrentDeployment.ID)

		suite.Len(service.Edges.Deployments, 1)
		suite.Equal(suite.testDeployment.ID, service.Edges.Deployments[0].ID)
	})

	suite.Run("GetByID With Last Successful Deployment", func() {
		// Create a failed deployment that's more recent
		failedDeployment := suite.DB.Deployment.Create().
			SetServiceID(suite.testService.ID).
			SetStatus(schema.DeploymentStatusBuildFailed).
			SetSource(schema.DeploymentSourceManual).
			SetBuilder(schema.ServiceBuilderDocker).
			SetCommitSha("def456").
			SetCommitMessage("Failed commit").
			SetCommitAuthor(&schema.GitCommitter{
				Name:      "Test User",
				AvatarURL: "https://github.com/test.png",
			}).
			SaveX(suite.Ctx)

		service, err := suite.serviceRepo.GetByID(suite.Ctx, suite.testService.ID)
		suite.NoError(err)
		suite.NotNil(service)

		// Should have both deployments: latest (failed) and last successful
		suite.Len(service.Edges.Deployments, 2)
		suite.Equal(failedDeployment.ID, service.Edges.Deployments[0].ID)     // Latest first
		suite.Equal(suite.testDeployment.ID, service.Edges.Deployments[1].ID) // Last successful
	})

	suite.Run("GetByID Non-existent Service", func() {
		_, err := suite.serviceRepo.GetByID(suite.Ctx, uuid.New())
		suite.Error(err)
		suite.True(ent.IsNotFound(err))
	})

	suite.Run("GetByID Error when DB closed", func() {
		suite.DB.Close()
		_, err := suite.serviceRepo.GetByID(suite.Ctx, suite.testService.ID)
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *ServiceQueriesSuite) TestGetByIDsAndEnvironment() {
	suite.Run("GetByIDsAndEnvironment Success", func() {
		// Create another service in the same environment
		service2 := suite.DB.Service.Create().
			SetType(schema.ServiceTypeGithub).
			SetKubernetesName("test-service-2").
			SetName("Test Service 2").
			SetEnvironmentID(suite.testEnvironment.ID).
			SetKubernetesSecret("test-service-2-secret").
			SaveX(suite.Ctx)

		serviceIDs := []uuid.UUID{suite.testService.ID, service2.ID}
		services, err := suite.serviceRepo.GetByIDsAndEnvironment(suite.Ctx, serviceIDs, suite.testEnvironment.ID)

		suite.NoError(err)
		suite.Len(services, 2)

		foundIDs := []uuid.UUID{services[0].ID, services[1].ID}
		suite.Contains(foundIDs, suite.testService.ID)
		suite.Contains(foundIDs, service2.ID)
	})

	suite.Run("GetByIDsAndEnvironment Empty Result", func() {
		// Use wrong environment ID
		wrongEnvID := uuid.New()
		services, err := suite.serviceRepo.GetByIDsAndEnvironment(suite.Ctx, []uuid.UUID{suite.testService.ID}, wrongEnvID)

		suite.NoError(err)
		suite.Len(services, 0)
	})

	suite.Run("GetByIDsAndEnvironment Error when DB closed", func() {
		suite.DB.Close()
		_, err := suite.serviceRepo.GetByIDsAndEnvironment(suite.Ctx, []uuid.UUID{suite.testService.ID}, suite.testEnvironment.ID)
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *ServiceQueriesSuite) TestGetByName() {
	suite.Run("GetByName Success", func() {
		service, err := suite.serviceRepo.GetByName(suite.Ctx, "Test Service")
		suite.NoError(err)
		suite.NotNil(service)
		suite.Equal(suite.testService.ID, service.ID)
		suite.Equal("Test Service", service.Name)

		// Check edges are loaded
		suite.NotNil(service.Edges.Environment)
		suite.NotNil(service.Edges.Environment.Edges.Project)
		suite.NotNil(service.Edges.Environment.Edges.Project.Edges.Team)
	})

	suite.Run("GetByName Non-existent Service", func() {
		_, err := suite.serviceRepo.GetByName(suite.Ctx, "Non-existent Service")
		suite.Error(err)
		suite.True(ent.IsNotFound(err))
	})

	suite.Run("GetByName Error when DB closed", func() {
		suite.DB.Close()
		_, err := suite.serviceRepo.GetByName(suite.Ctx, "Test Service")
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *ServiceQueriesSuite) TestGetDatabaseType() {
	suite.Run("GetDatabaseType Success", func() {
		// Create a database service
		dbService := suite.DB.Service.Create().
			SetType(schema.ServiceTypeDatabase).
			SetKubernetesName("db-service").
			SetName("Database Service").
			SetEnvironmentID(suite.testEnvironment.ID).
			SetKubernetesSecret("db-secret").
			SetDatabase("postgresql").
			SaveX(suite.Ctx)

		dbType, err := suite.serviceRepo.GetDatabaseType(suite.Ctx, dbService.ID)
		suite.NoError(err)
		suite.Equal("postgresql", dbType)
	})

	suite.Run("GetDatabaseType No Database", func() {
		dbType, err := suite.serviceRepo.GetDatabaseType(suite.Ctx, suite.testService.ID)
		suite.NoError(err)
		suite.Equal("", dbType)
	})

	suite.Run("GetDatabaseType Non-existent Service", func() {
		_, err := suite.serviceRepo.GetDatabaseType(suite.Ctx, uuid.New())
		suite.Error(err)
		suite.True(ent.IsNotFound(err))
	})

	suite.Run("GetDatabaseType Error when DB closed", func() {
		suite.DB.Close()
		_, err := suite.serviceRepo.GetDatabaseType(suite.Ctx, suite.testService.ID)
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *ServiceQueriesSuite) TestGetDatabases() {
	suite.Run("GetDatabases Success", func() {
		// Create database services
		db1 := suite.DB.Service.Create().
			SetType(schema.ServiceTypeDatabase).
			SetKubernetesName("db-1").
			SetName("Database 1").
			SetEnvironmentID(suite.testEnvironment.ID).
			SetKubernetesSecret("db-1-secret").
			SetDatabase("postgresql").
			SaveX(suite.Ctx)

		db2 := suite.DB.Service.Create().
			SetType(schema.ServiceTypeDatabase).
			SetKubernetesName("db-2").
			SetName("Database 2").
			SetEnvironmentID(suite.testEnvironment.ID).
			SetKubernetesSecret("db-2-secret").
			SetDatabase("mysql").
			SaveX(suite.Ctx)

		// Create configs for them
		suite.DB.ServiceConfig.Create().
			SetServiceID(db1.ID).
			SetBuilder(schema.ServiceBuilderRailpack).
			SetIcon("postgresql").
			SaveX(suite.Ctx)

		suite.DB.ServiceConfig.Create().
			SetServiceID(db2.ID).
			SetBuilder(schema.ServiceBuilderRailpack).
			SetIcon("mysql").
			SaveX(suite.Ctx)

		databases, err := suite.serviceRepo.GetDatabases(suite.Ctx)
		suite.NoError(err)
		suite.GreaterOrEqual(len(databases), 2)

		// Check that all returned services are databases
		for _, db := range databases {
			suite.Equal(schema.ServiceTypeDatabase, db.Type)
			suite.NotNil(db.Edges.ServiceConfig)
			suite.NotNil(db.Edges.Environment)
			suite.NotNil(db.Edges.Environment.Edges.Project)
			suite.NotNil(db.Edges.Environment.Edges.Project.Edges.Team)
		}
	})

	suite.Run("GetDatabases Error when DB closed", func() {
		suite.DB.Close()
		_, err := suite.serviceRepo.GetDatabases(suite.Ctx)
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *ServiceQueriesSuite) TestGetByInstallationIDAndRepoName() {
	suite.Run("GetByInstallationIDAndRepoName Success", func() {
		services, err := suite.serviceRepo.GetByInstallationIDAndRepoName(suite.Ctx, suite.testGithubInstallation.ID, "test-repo")
		suite.NoError(err)
		suite.Len(services, 1)
		suite.Equal(suite.testService.ID, services[0].ID)
		suite.NotNil(services[0].Edges.ServiceConfig)
		suite.NotNil(services[0].Edges.CurrentDeployment)
	})

	suite.Run("GetByInstallationIDAndRepoName No Results", func() {
		services, err := suite.serviceRepo.GetByInstallationIDAndRepoName(suite.Ctx, suite.testGithubInstallation.ID, "non-existent-repo")
		suite.NoError(err)
		suite.Len(services, 0)
	})

	suite.Run("GetByInstallationIDAndRepoName Error when DB closed", func() {
		suite.DB.Close()
		_, err := suite.serviceRepo.GetByInstallationIDAndRepoName(suite.Ctx, suite.testGithubInstallation.ID, "test-repo")
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *ServiceQueriesSuite) TestGetByEnvironmentID() {
	suite.Run("GetByEnvironmentID Success", func() {
		// Create another service in the same environment
		service2 := suite.DB.Service.Create().
			SetType(schema.ServiceTypeGithub).
			SetKubernetesName("test-service-2").
			SetName("Test Service 2").
			SetEnvironmentID(suite.testEnvironment.ID).
			SetKubernetesSecret("test-service-2-secret").
			SaveX(suite.Ctx)

		services, err := suite.serviceRepo.GetByEnvironmentID(suite.Ctx, suite.testEnvironment.ID, nil, false)
		suite.NoError(err)
		suite.GreaterOrEqual(len(services), 2)

		// Should find our service
		var foundTestService bool
		for _, svc := range services {
			if svc.ID == suite.testService.ID {
				foundTestService = true
				break
			}
		}
		suite.True(foundTestService)

		// Use service2 to avoid unused variable warning
		suite.NotEqual(service2.ID, uuid.Nil)
	})

	suite.Run("GetByEnvironmentID With Latest Deployment", func() {
		// Create a more recent deployment
		recentDeployment := suite.DB.Deployment.Create().
			SetServiceID(suite.testService.ID).
			SetStatus(schema.DeploymentStatusBuildRunning).
			SetSource(schema.DeploymentSourceManual).
			SetBuilder(schema.ServiceBuilderDocker).
			SetCommitSha("recent123").
			SetCommitMessage("Recent commit").
			SetCommitAuthor(&schema.GitCommitter{
				Name:      "Test User",
				AvatarURL: "https://github.com/test.png",
			}).
			SaveX(suite.Ctx)

		services, err := suite.serviceRepo.GetByEnvironmentID(suite.Ctx, suite.testEnvironment.ID, nil, true)
		suite.NoError(err)
		suite.Greater(len(services), 0)

		// Find our test service
		var testService *ent.Service
		for _, svc := range services {
			if svc.ID == suite.testService.ID {
				testService = svc
				break
			}
		}
		suite.NotNil(testService)

		// Should have latest deployment and last successful
		suite.GreaterOrEqual(len(testService.Edges.Deployments), 1)
		suite.Equal(recentDeployment.ID, testService.Edges.Deployments[0].ID)

		// If latest is not successful, should also have last successful
		if testService.Edges.Deployments[0].Status != schema.DeploymentStatusBuildSucceeded {
			suite.Len(testService.Edges.Deployments, 2)
			suite.Equal(suite.testDeployment.ID, testService.Edges.Deployments[1].ID)
		}
	})

	suite.Run("GetByEnvironmentID Empty Result", func() {
		services, err := suite.serviceRepo.GetByEnvironmentID(suite.Ctx, uuid.New(), nil, false)
		suite.NoError(err)
		suite.Len(services, 0)
	})

	suite.Run("GetByEnvironmentID Error when DB closed", func() {
		suite.DB.Close()
		_, err := suite.serviceRepo.GetByEnvironmentID(suite.Ctx, suite.testEnvironment.ID, nil, false)
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *ServiceQueriesSuite) TestGetGithubPrivateKey() {
	suite.Run("GetGithubPrivateKey Success", func() {
		privateKey, err := suite.serviceRepo.GetGithubPrivateKey(suite.Ctx, suite.testService.ID)
		suite.NoError(err)
		suite.Equal("test-private-key", privateKey)
	})

	suite.Run("GetGithubPrivateKey No Installation", func() {
		// Create service without GitHub installation
		service := suite.DB.Service.Create().
			SetType(schema.ServiceTypeGithub).
			SetKubernetesName("no-github").
			SetName("No GitHub Service").
			SetEnvironmentID(suite.testEnvironment.ID).
			SetKubernetesSecret("no-github-secret").
			SaveX(suite.Ctx)

		privateKey, err := suite.serviceRepo.GetGithubPrivateKey(suite.Ctx, service.ID)
		suite.NoError(err)
		suite.Equal("", privateKey)
	})

	suite.Run("GetGithubPrivateKey Non-existent Service", func() {
		_, err := suite.serviceRepo.GetGithubPrivateKey(suite.Ctx, uuid.New())
		suite.Error(err)
		suite.True(ent.IsNotFound(err))
	})

	suite.Run("GetGithubPrivateKey Error when DB closed", func() {
		suite.DB.Close()
		_, err := suite.serviceRepo.GetGithubPrivateKey(suite.Ctx, suite.testService.ID)
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *ServiceQueriesSuite) TestCountDomainCollisions() {
	suite.Run("CountDomainCollisions Success", func() {
		// Create another service with the same domain
		service2 := suite.DB.Service.Create().
			SetType(schema.ServiceTypeGithub).
			SetKubernetesName("test-service-2").
			SetName("Test Service 2").
			SetEnvironmentID(suite.testEnvironment.ID).
			SetKubernetesSecret("test-service-2-secret").
			SaveX(suite.Ctx)

		suite.DB.ServiceConfig.Create().
			SetServiceID(service2.ID).
			SetBuilder(schema.ServiceBuilderRailpack).
			SetIcon("nodejs").
			SetHosts([]schema.HostSpec{
				{Host: "example.com", TargetPort: utils.ToPtr(int32(3000))},
			}).
			SaveX(suite.Ctx)

		count, err := suite.serviceRepo.CountDomainCollisons(suite.Ctx, nil, "example.com", nil)
		suite.NoError(err)
		suite.Equal(2, count) // Both services use example.com
	})

	suite.Run("CountDomainCollisions Case Insensitive", func() {
		count, err := suite.serviceRepo.CountDomainCollisons(suite.Ctx, nil, "EXAMPLE.COM", nil)
		suite.NoError(err)
		suite.GreaterOrEqual(count, 1) // Should find our existing service
	})

	suite.Run("CountDomainCollisions excluding services", func() {
		count, err := suite.serviceRepo.CountDomainCollisons(suite.Ctx, nil, "example.com", &suite.testService.ID)
		suite.NoError(err)
		suite.Equal(1, count) // Only the other service should be counted
	})

	suite.Run("CountDomainCollisions No Collisions", func() {
		count, err := suite.serviceRepo.CountDomainCollisons(suite.Ctx, nil, "unique-domain.com", nil)
		suite.NoError(err)
		suite.Equal(0, count)
	})

	suite.Run("CountDomainCollisions Error when DB closed", func() {
		suite.DB.Close()
		count, err := suite.serviceRepo.CountDomainCollisons(suite.Ctx, nil, "example.com", nil)
		suite.NoError(err) // This method handles DB errors gracefully
		suite.Equal(0, count)
	})
}

func (suite *ServiceQueriesSuite) TestGetDeploymentNamespace() {
	suite.Run("GetDeploymentNamespace Success", func() {
		namespace, err := suite.serviceRepo.GetDeploymentNamespace(suite.Ctx, suite.testService.ID)
		suite.NoError(err)
		suite.Equal("test-namespace", namespace)
	})

	suite.Run("GetDeploymentNamespace Non-existent Service", func() {
		_, err := suite.serviceRepo.GetDeploymentNamespace(suite.Ctx, uuid.New())
		suite.Error(err)
		suite.True(ent.IsNotFound(err))
	})

	suite.Run("GetDeploymentNamespace Error when DB closed", func() {
		suite.DB.Close()
		_, err := suite.serviceRepo.GetDeploymentNamespace(suite.Ctx, suite.testService.ID)
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *ServiceQueriesSuite) TestSummarizeServices() {
	suite.Run("SummarizeServices Success", func() {
		// Create another environment with services
		env2 := suite.DB.Environment.Create().
			SetKubernetesName("test-env-2").
			SetName("Test Environment 2").
			SetProjectID(suite.testProject.ID).
			SetKubernetesSecret("test-env-2-secret").
			SaveX(suite.Ctx)

		service2 := suite.DB.Service.Create().
			SetType(schema.ServiceTypeGithub).
			SetKubernetesName("test-service-2").
			SetName("Test Service 2").
			SetEnvironmentID(env2.ID).
			SetKubernetesSecret("test-service-2-secret").
			SaveX(suite.Ctx)

		suite.DB.ServiceConfig.Create().
			SetServiceID(service2.ID).
			SetBuilder(schema.ServiceBuilderRailpack).
			SetIcon("python").
			SaveX(suite.Ctx)

		environmentIDs := []uuid.UUID{suite.testEnvironment.ID, env2.ID}
		counts, icons, err := suite.serviceRepo.SummarizeServices(suite.Ctx, environmentIDs)

		suite.NoError(err)
		suite.NotNil(counts)
		suite.NotNil(icons)

		suite.GreaterOrEqual(counts[suite.testEnvironment.ID], 1)
		suite.GreaterOrEqual(counts[env2.ID], 1)

		suite.Contains(icons[suite.testEnvironment.ID], "nodejs")
		suite.Contains(icons[env2.ID], "python")
	})

	suite.Run("SummarizeServices Empty Environments", func() {
		environmentIDs := []uuid.UUID{uuid.New(), uuid.New()}
		counts, icons, err := suite.serviceRepo.SummarizeServices(suite.Ctx, environmentIDs)

		suite.NoError(err)
		suite.NotNil(counts)
		suite.NotNil(icons)

		for _, envID := range environmentIDs {
			suite.Equal(0, counts[envID])
			suite.Len(icons[envID], 0)
		}
	})

	suite.Run("SummarizeServices Error when DB closed", func() {
		suite.DB.Close()
		_, _, err := suite.serviceRepo.SummarizeServices(suite.Ctx, []uuid.UUID{suite.testEnvironment.ID})
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *ServiceQueriesSuite) TestNeedsDeployment() {
	suite.Run("NeedsDeployment No Current Deployment", func() {
		// Create service without current deployment
		service := suite.DB.Service.Create().
			SetType(schema.ServiceTypeGithub).
			SetKubernetesName("no-deployment").
			SetName("No Deployment Service").
			SetEnvironmentID(suite.testEnvironment.ID).
			SetKubernetesSecret("no-deployment-secret").
			SaveX(suite.Ctx)

		config := suite.DB.ServiceConfig.Create().
			SetServiceID(service.ID).
			SetBuilder(schema.ServiceBuilderRailpack).
			SetIcon("nodejs").
			SaveX(suite.Ctx)

		// Load service with edges
		service, err := suite.DB.Service.Query().
			Where(entService.IDEQ(service.ID)).
			WithServiceConfig().
			WithCurrentDeployment().
			Only(suite.Ctx)
		suite.NoError(err)

		result, err := suite.serviceRepo.NeedsDeployment(suite.Ctx, service)
		suite.NoError(err)
		suite.Equal(NoDeploymentNeeded, result)

		// Use config to avoid unused variable warning
		suite.NotEqual(config.ID, uuid.Nil)
	})

	suite.Run("NeedsDeployment No Resource Definition", func() {
		// Create deployment without resource definition
		deployment := suite.DB.Deployment.Create().
			SetServiceID(suite.testService.ID).
			SetStatus(schema.DeploymentStatusBuildSucceeded).
			SetSource(schema.DeploymentSourceManual).
			SetBuilder(schema.ServiceBuilderDocker).
			SetCommitSha("nodef123").
			SetCommitMessage("No definition").
			SetCommitAuthor(&schema.GitCommitter{
				Name:      "Test User",
				AvatarURL: "https://github.com/test.png",
			}).
			SaveX(suite.Ctx)

		service := suite.DB.Service.UpdateOneID(suite.testService.ID).
			SetCurrentDeploymentID(deployment.ID).
			SaveX(suite.Ctx)

		// Load with edges
		service, err := suite.DB.Service.Query().
			Where(entService.IDEQ(service.ID)).
			WithServiceConfig().
			WithCurrentDeployment().
			Only(suite.Ctx)
		suite.NoError(err)

		result, err := suite.serviceRepo.NeedsDeployment(suite.Ctx, service)
		suite.NoError(err)
		suite.Equal(NoDeploymentNeeded, result)
	})

	suite.Run("NeedsDeployment Builder Changed", func() {
		// Ensure the original deployment is set as current (this represents the OLD deployed state)
		// The original deployment has builder="railpack" in its resource definition
		suite.DB.Service.UpdateOneID(suite.testService.ID).
			SetCurrentDeploymentID(suite.testDeployment.ID).
			SaveX(suite.Ctx)

		// Update service config to use different builder (this represents the NEW desired state)
		suite.DB.ServiceConfig.UpdateOneID(suite.testConfig.ID).
			SetBuilder(schema.ServiceBuilderDocker).
			SaveX(suite.Ctx)

		// Load service with edges
		service, err := suite.DB.Service.Query().
			Where(entService.IDEQ(suite.testService.ID)).
			WithServiceConfig().
			WithCurrentDeployment().
			Only(suite.Ctx)
		suite.NoError(err)

		// Verify the test setup
		suite.NotNil(service.Edges.ServiceConfig)
		suite.Equal(schema.ServiceBuilderDocker, service.Edges.ServiceConfig.Builder) // NEW state
		suite.NotNil(service.Edges.CurrentDeployment)
		suite.NotNil(service.Edges.CurrentDeployment.ResourceDefinition)
		suite.Equal("railpack", service.Edges.CurrentDeployment.ResourceDefinition.Spec.Builder) // OLD state

		result, err := suite.serviceRepo.NeedsDeployment(suite.Ctx, service)
		suite.NoError(err)
		suite.Equal(NeedsBuildAndDeployment, result)
	})

	suite.Run("NeedsDeployment Branch Changed", func() {
		// Ensure the original deployment is set as current (this represents the OLD deployed state)
		// The original deployment has GitBranch="refs/heads/main" in its resource definition
		suite.DB.Service.UpdateOneID(suite.testService.ID).
			SetCurrentDeploymentID(suite.testDeployment.ID).
			SaveX(suite.Ctx)

		// Update service config git branch (this represents the NEW desired state)
		suite.DB.ServiceConfig.UpdateOneID(suite.testConfig.ID).
			SetGitBranch("develop").
			SaveX(suite.Ctx)

		// Load service with edges
		service, err := suite.DB.Service.Query().
			Where(entService.IDEQ(suite.testService.ID)).
			WithServiceConfig().
			WithCurrentDeployment().
			Only(suite.Ctx)
		suite.NoError(err)

		// Verify the test setup
		suite.NotNil(service.Edges.ServiceConfig)
		suite.NotNil(service.Edges.ServiceConfig.GitBranch)
		suite.Equal("develop", *service.Edges.ServiceConfig.GitBranch) // NEW state
		suite.NotNil(service.Edges.CurrentDeployment)
		suite.NotNil(service.Edges.CurrentDeployment.ResourceDefinition)
		suite.Equal("refs/heads/main", service.Edges.CurrentDeployment.ResourceDefinition.Spec.Config.GitBranch) // OLD state

		result, err := suite.serviceRepo.NeedsDeployment(suite.Ctx, service)
		suite.NoError(err)
		suite.Equal(NeedsBuildAndDeployment, result)
	})

	suite.Run("NeedsDeployment Config Changed", func() {
		// Ensure the original deployment is set as current (this represents the OLD deployed state)
		// The original deployment has Replicas=1 in its resource definition
		suite.DB.Service.UpdateOneID(suite.testService.ID).
			SetCurrentDeploymentID(suite.testDeployment.ID).
			SaveX(suite.Ctx)

		// First, set service config to match the deployment (to have a baseline)
		suite.DB.ServiceConfig.UpdateOneID(suite.testConfig.ID).
			SetBuilder(schema.ServiceBuilderRailpack). // Matches deployment
			SetReplicas(1).                            // Matches deployment
			SetGitBranch("main").                      // Will become "refs/heads/main" to match deployment
			ClearDatabaseConfig().
			ClearVolumes().
			SaveX(suite.Ctx)

		// Now update only the replica count (this represents the NEW desired state)
		suite.DB.ServiceConfig.UpdateOneID(suite.testConfig.ID).
			SetReplicas(3).
			SaveX(suite.Ctx)

		// Load service with edges
		service, err := suite.DB.Service.Query().
			Where(entService.IDEQ(suite.testService.ID)).
			WithServiceConfig().
			WithCurrentDeployment().
			Only(suite.Ctx)
		suite.NoError(err)

		// Verify the test setup
		suite.NotNil(service.Edges.ServiceConfig)
		suite.Equal(int32(3), service.Edges.ServiceConfig.Replicas)                     // NEW state
		suite.Equal(schema.ServiceBuilderRailpack, service.Edges.ServiceConfig.Builder) // Should match deployment
		suite.NotNil(service.Edges.ServiceConfig.GitBranch)
		suite.Equal("main", *service.Edges.ServiceConfig.GitBranch) // Should match deployment
		suite.NotNil(service.Edges.CurrentDeployment)
		suite.NotNil(service.Edges.CurrentDeployment.ResourceDefinition)
		suite.Equal(int32(1), *service.Edges.CurrentDeployment.ResourceDefinition.Spec.Config.Replicas) // OLD state

		result, err := suite.serviceRepo.NeedsDeployment(suite.Ctx, service)
		suite.NoError(err)
		suite.Equal(NeedsDeployment, result)
	})

	suite.Run("NeedsDeployment No Changes", func() {
		// Ensure the original deployment is set as current (this represents the deployed state)
		suite.DB.Service.UpdateOneID(suite.testService.ID).
			SetCurrentDeploymentID(suite.testDeployment.ID).
			SaveX(suite.Ctx)

		// Set service config to match the deployment exactly (no changes)
		suite.DB.ServiceConfig.UpdateOneID(suite.testConfig.ID).
			SetBuilder(schema.ServiceBuilderRailpack). // Matches deployment
			SetReplicas(1).                            // Matches deployment
			SetGitBranch("main").                      // Will become "refs/heads/main" to match deployment
			ClearDatabaseConfig().
			ClearVolumes().
			SaveX(suite.Ctx)

		// Load service with edges
		service, err := suite.DB.Service.Query().
			Where(entService.IDEQ(suite.testService.ID)).
			WithServiceConfig().
			WithCurrentDeployment().
			Only(suite.Ctx)
		suite.NoError(err)

		// Verify the test setup - both should represent the same state
		suite.NotNil(service.Edges.ServiceConfig)
		suite.Equal(schema.ServiceBuilderRailpack, service.Edges.ServiceConfig.Builder)
		suite.Equal(int32(1), service.Edges.ServiceConfig.Replicas)
		suite.NotNil(service.Edges.ServiceConfig.GitBranch)
		suite.Equal("main", *service.Edges.ServiceConfig.GitBranch)
		suite.NotNil(service.Edges.CurrentDeployment)
		suite.NotNil(service.Edges.CurrentDeployment.ResourceDefinition)

		result, err := suite.serviceRepo.NeedsDeployment(suite.Ctx, service)
		suite.NoError(err)
		suite.Equal(NoDeploymentNeeded, result)
	})
}

func (suite *ServiceQueriesSuite) TestIsVolumeInUse() {
	suite.Run("IsVolumeInUse Success", func() {
		// Add volume to service config
		volumes := []schema.ServiceVolume{
			{
				ID:        "test-volume-123",
				MountPath: "/data",
			},
		}
		suite.DB.ServiceConfig.UpdateOneID(suite.testConfig.ID).
			SetVolumes(volumes).
			SaveX(suite.Ctx)

		inUse, err := suite.serviceRepo.IsVolumeInUse(suite.Ctx, "test-volume-123")
		suite.NoError(err)
		suite.True(inUse)

		// Clean up after test
		suite.DB.ServiceConfig.UpdateOneID(suite.testConfig.ID).
			ClearVolumes().
			SaveX(suite.Ctx)
	})

	suite.Run("IsVolumeInUse Not In Use", func() {
		inUse, err := suite.serviceRepo.IsVolumeInUse(suite.Ctx, "non-existent-volume")
		suite.NoError(err)
		suite.False(inUse)
	})

	suite.Run("IsVolumeInUse Error when DB closed", func() {
		suite.DB.Close()
		_, err := suite.serviceRepo.IsVolumeInUse(suite.Ctx, "test-volume")
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *ServiceQueriesSuite) TestGetServicesUsingPVC() {
	suite.Run("GetServicesUsingPVC Success", func() {
		// Add volume to service config
		volumes := []schema.ServiceVolume{
			{
				ID:        "pvc-123",
				MountPath: "/data",
			},
		}
		suite.DB.ServiceConfig.UpdateOneID(suite.testConfig.ID).
			SetVolumes(volumes).
			SaveX(suite.Ctx)

		services, err := suite.serviceRepo.GetServicesUsingPVC(suite.Ctx, "pvc-123")
		suite.NoError(err)
		suite.Len(services, 1)
		suite.Equal(suite.testService.ID, services[0].ID)

		// Clean up after test
		suite.DB.ServiceConfig.UpdateOneID(suite.testConfig.ID).
			ClearVolumes().
			SaveX(suite.Ctx)
	})

	suite.Run("GetServicesUsingPVC No Results", func() {
		services, err := suite.serviceRepo.GetServicesUsingPVC(suite.Ctx, "non-existent-pvc")
		suite.NoError(err)
		suite.Len(services, 0)
	})

	suite.Run("GetServicesUsingPVC Error when DB closed", func() {
		suite.DB.Close()
		_, err := suite.serviceRepo.GetServicesUsingPVC(suite.Ctx, "pvc-123")
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *ServiceQueriesSuite) TestGetPVCMountPaths() {
	suite.Run("GetPVCMountPaths Success", func() {
		// Add volume to service config
		volumes := []schema.ServiceVolume{
			{
				ID:        "pvc-mount-123",
				MountPath: "/app/data",
			},
		}
		suite.DB.ServiceConfig.UpdateOneID(suite.testConfig.ID).
			SetVolumes(volumes).
			SaveX(suite.Ctx)

		pvcs := []*models.PVCInfo{
			{
				ID:         "pvc-mount-123",
				IsDatabase: false,
			},
		}

		mountPaths, err := suite.serviceRepo.GetPVCMountPaths(suite.Ctx, pvcs)
		suite.NoError(err)
		suite.Len(mountPaths, 1)
		suite.NotNil(mountPaths)
		suite.Equal("/app/data", mountPaths["pvc-mount-123"])

		// Clean up after test
		suite.DB.ServiceConfig.UpdateOneID(suite.testConfig.ID).
			ClearVolumes().
			SaveX(suite.Ctx)
	})

	suite.Run("GetPVCMountPaths Database PVC", func() {
		// Create database service
		dbService := suite.DB.Service.Create().
			SetType(schema.ServiceTypeDatabase).
			SetKubernetesName("db-service").
			SetName("Database Service").
			SetEnvironmentID(suite.testEnvironment.ID).
			SetKubernetesSecret("db-secret").
			SetDatabase("postgresql").
			SaveX(suite.Ctx)

		pvcs := []*models.PVCInfo{
			{
				ID:                 "db-pvc-123",
				IsDatabase:         true,
				MountedOnServiceID: &dbService.ID,
			},
		}

		mountPaths, err := suite.serviceRepo.GetPVCMountPaths(suite.Ctx, pvcs)
		suite.NoError(err)
		suite.NotNil(mountPaths)

		// Should have inferred mount path for postgresql
		mountPath, exists := mountPaths["db-pvc-123"]
		suite.True(exists)
		suite.NotEmpty(mountPath)
	})

	suite.Run("GetPVCMountPaths Empty PVCs", func() {
		mountPaths, err := suite.serviceRepo.GetPVCMountPaths(suite.Ctx, []*models.PVCInfo{})
		suite.NoError(err)
		suite.NotNil(mountPaths)
		suite.Len(mountPaths, 0)
	})

	suite.Run("GetPVCMountPaths Error when DB closed", func() {
		suite.DB.Close()
		pvcs := []*models.PVCInfo{
			{ID: "test-pvc", IsDatabase: false},
		}
		_, err := suite.serviceRepo.GetPVCMountPaths(suite.Ctx, pvcs)
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *ServiceQueriesSuite) TestGetDatabaseConfig() {
	suite.Run("GetDatabaseConfig Success", func() {
		// Set database config
		dbConfig := &schema.DatabaseConfig{
			StorageSize: "10Gi",
			Version:     "14",
		}
		suite.DB.ServiceConfig.UpdateOneID(suite.testConfig.ID).
			SetDatabaseConfig(dbConfig).
			SaveX(suite.Ctx)

		config, err := suite.serviceRepo.GetDatabaseConfig(suite.Ctx, suite.testService.ID)
		suite.NoError(err)
		suite.NotNil(config)
		suite.Equal("10Gi", config.StorageSize)
		suite.Equal("14", config.Version)
	})

	suite.Run("GetDatabaseConfig Nil Config", func() {
		// Ensure we start with a clean config that has no database config
		suite.DB.ServiceConfig.UpdateOneID(suite.testConfig.ID).
			ClearDatabaseConfig().
			SaveX(suite.Ctx)

		config, err := suite.serviceRepo.GetDatabaseConfig(suite.Ctx, suite.testService.ID)
		suite.NoError(err)
		suite.Nil(config)
	})

	suite.Run("GetDatabaseConfig Non-existent Service", func() {
		_, err := suite.serviceRepo.GetDatabaseConfig(suite.Ctx, uuid.New())
		suite.Error(err)
		suite.True(ent.IsNotFound(err))
	})

	suite.Run("GetDatabaseConfig Error when DB closed", func() {
		suite.DB.Close()
		_, err := suite.serviceRepo.GetDatabaseConfig(suite.Ctx, suite.testService.ID)
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func TestServiceQueriesSuite(t *testing.T) {
	suite.Run(t, new(ServiceQueriesSuite))
}
