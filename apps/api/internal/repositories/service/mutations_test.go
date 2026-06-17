package service_repo

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/githubinstallation"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/ent/serviceconfig"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	deployment_repo "github.com/unbindapp/unbind-api/internal/repositories/deployment"
	"github.com/unbindapp/unbind-api/internal/sourceanalyzer/enum"
	"golang.org/x/crypto/bcrypt"
)

type ServiceMutationsSuite struct {
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

func (suite *ServiceMutationsSuite) SetupTest() {
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

	// Create test service
	suite.testService = suite.DB.Service.Create().
		SetType(schema.ServiceTypeGithub).
		SetKubernetesName("test-service").
		SetName("Test Service").
		SetDescription("Test service description").
		SetEnvironmentID(suite.testEnvironment.ID).
		SetKubernetesSecret("test-service-secret").
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
		SaveX(suite.Ctx)

	// Create test deployment
	suite.testDeployment = suite.DB.Deployment.Create().
		SetServiceID(suite.testService.ID).
		SetStatus(schema.DeploymentStatusBuildQueued).
		SetSource(schema.DeploymentSourceManual).
		SetCommitSha("abc123").
		SetCommitMessage("Initial commit").
		SetBuilder(schema.ServiceBuilderRailpack).
		SetCommitAuthor(&schema.GitCommitter{
			Name:      "Test User",
			AvatarURL: "https://github.com/test.png",
		}).
		SaveX(suite.Ctx)

		// Create test github app
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
}

func (suite *ServiceMutationsSuite) TearDownTest() {
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
}

func (suite *ServiceMutationsSuite) TestCreate() {
	suite.Run("Create Success", func() {
		input := &CreateServiceInput{
			KubernetesName:   "new-service",
			Name:             "New Service",
			ServiceType:      schema.ServiceTypeDatabase,
			Description:      "New test service",
			EnvironmentID:    suite.testEnvironment.ID,
			KubernetesSecret: "new-service-secret",
			Database:         utils.ToPtr("postgresql"),
			DatabaseVersion:  utils.ToPtr("14"),
			DetectedPorts: []schema.PortSpec{
				{Port: 5432, Protocol: utils.ToPtr(schema.ProtocolTCP)},
			},
		}

		service, err := suite.serviceRepo.Create(suite.Ctx, nil, input)
		suite.NoError(err)
		suite.NotNil(service)
		suite.Equal("new-service", service.KubernetesName)
		suite.Equal("New Service", service.Name)
		suite.Equal(schema.ServiceTypeDatabase, service.Type)
		suite.Equal("New test service", service.Description)
		suite.Equal(suite.testEnvironment.ID, service.EnvironmentID)
		suite.Equal("new-service-secret", service.KubernetesSecret)
		suite.NotNil(service.Database)
		suite.Equal("postgresql", *service.Database)
		suite.NotNil(service.DatabaseVersion)
		suite.Equal("14", *service.DatabaseVersion)
		suite.Len(service.DetectedPorts, 1)
		suite.Equal(int32(5432), service.DetectedPorts[0].Port)
	})

	suite.Run("Create With GitHub Info", func() {
		input := &CreateServiceInput{
			KubernetesName:       "github-service",
			Name:                 "GitHub Service",
			ServiceType:          schema.ServiceTypeGithub,
			Description:          "Service with GitHub integration",
			EnvironmentID:        suite.testEnvironment.ID,
			GitHubInstallationID: &suite.testGithubInstallation.ID,
			GitRepository:        utils.ToPtr("test-repo"),
			GitRepositoryOwner:   utils.ToPtr("test-owner"),
			KubernetesSecret:     "github-service-secret",
		}

		service, err := suite.serviceRepo.Create(suite.Ctx, nil, input)
		suite.NoError(err)
		suite.NotNil(service)
		suite.NotNil(service.GithubInstallationID)
		suite.Equal(suite.testGithubInstallation.ID, *service.GithubInstallationID)
		suite.NotNil(service.GitRepository)
		suite.Equal("test-repo", *service.GitRepository)
		suite.NotNil(service.GitRepositoryOwner)
		suite.Equal("test-owner", *service.GitRepositoryOwner)
	})

	suite.Run("Create Non-existent Environment", func() {
		input := &CreateServiceInput{
			KubernetesName:   "invalid-service",
			Name:             "Invalid Service",
			ServiceType:      schema.ServiceTypeGithub,
			Description:      "Service with invalid environment",
			EnvironmentID:    uuid.New(),
			KubernetesSecret: "invalid-service-secret",
		}

		service, err := suite.serviceRepo.Create(suite.Ctx, nil, input)
		suite.Error(err)
		suite.Nil(service)
	})

	suite.Run("Create Error when DB closed", func() {
		input := &CreateServiceInput{
			KubernetesName:   "closed-db-service",
			Name:             "Closed DB Service",
			ServiceType:      schema.ServiceTypeGithub,
			Description:      "Service with closed DB",
			EnvironmentID:    suite.testEnvironment.ID,
			KubernetesSecret: "closed-db-service-secret",
		}

		suite.DB.Close()
		service, err := suite.serviceRepo.Create(suite.Ctx, nil, input)
		suite.Error(err)
		suite.Nil(service)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *ServiceMutationsSuite) TestCreateConfig() {
	suite.Run("CreateConfig Success", func() {
		// Create a new service for this config
		service := suite.DB.Service.Create().
			SetType(schema.ServiceTypeGithub).
			SetKubernetesName("config-test-service").
			SetName("Config Test Service").
			SetDescription("Service for config testing").
			SetEnvironmentID(suite.testEnvironment.ID).
			SetKubernetesSecret("config-test-secret").
			SaveX(suite.Ctx)

		builder := schema.ServiceBuilderDocker
		provider := enum.Node
		framework := enum.Express
		input := &MutateConfigInput{
			ServiceID: service.ID,
			Builder:   &builder,
			Provider:  &provider,
			Framework: &framework,
			GitBranch: utils.ToPtr("main"),
			Icon:      utils.ToPtr("nodejs"),
			OverwritePorts: []schema.PortSpec{
				{Port: 8080, Protocol: utils.ToPtr(schema.ProtocolTCP)},
			},
			OverwriteHosts: []schema.HostSpec{
				{Host: "example.com", TargetPort: utils.ToPtr(int32(8080))},
			},
			Replicas:   utils.ToPtr[int32](3),
			AutoDeploy: utils.ToPtr(false),
			Public:     utils.ToPtr(true),
			Image:      utils.ToPtr("node:18"),
		}

		config, err := suite.serviceRepo.CreateConfig(suite.Ctx, nil, input)
		suite.NoError(err)
		suite.NotNil(config)
		suite.Equal(service.ID, config.ServiceID)
		suite.Equal(schema.ServiceBuilderDocker, config.Builder)
		suite.Equal("nodejs", config.Icon)
		suite.NotNil(config.RailpackProvider)
		suite.Equal(enum.Node, *config.RailpackProvider)
		suite.NotNil(config.RailpackFramework)
		suite.Equal(enum.Express, *config.RailpackFramework)
		suite.NotNil(config.GitBranch)
		suite.Equal("main", *config.GitBranch)
		suite.NotNil(config.Replicas)
		suite.Equal(int32(3), config.Replicas)
		suite.False(config.AutoDeploy)
		suite.True(config.IsPublic)
		suite.Equal("node:18", config.Image)
		suite.Len(config.Ports, 1)
		suite.Equal(int32(8080), config.Ports[0].Port)
		suite.Len(config.Hosts, 1)
		suite.Equal("example.com", config.Hosts[0].Host)
	})

	suite.Run("CreateConfig With Database Icon", func() {
		// Create a database service
		service := suite.DB.Service.Create().
			SetType(schema.ServiceTypeDatabase).
			SetKubernetesName("db-service").
			SetName("DB Service").
			SetDescription("Database service").
			SetEnvironmentID(suite.testEnvironment.ID).
			SetKubernetesSecret("db-secret").
			SetDatabase("postgresql").
			SaveX(suite.Ctx)

		builder := schema.ServiceBuilderRailpack
		input := &MutateConfigInput{
			ServiceID: service.ID,
			Builder:   &builder,
		}

		config, err := suite.serviceRepo.CreateConfig(suite.Ctx, nil, input)
		suite.NoError(err)
		suite.NotNil(config)
		suite.Equal("postgresql", config.Icon) // Should use database as icon
	})

	suite.Run("CreateConfig Missing Builder", func() {
		input := &MutateConfigInput{
			ServiceID: suite.testService.ID,
			Builder:   nil,
		}

		config, err := suite.serviceRepo.CreateConfig(suite.Ctx, nil, input)
		suite.Error(err)
		suite.Nil(config)
		suite.ErrorContains(err, "builder is missing")
	})

	suite.Run("CreateConfig Non-existent Service", func() {
		builder := schema.ServiceBuilderRailpack
		input := &MutateConfigInput{
			ServiceID: uuid.New(),
			Builder:   &builder,
		}

		config, err := suite.serviceRepo.CreateConfig(suite.Ctx, nil, input)
		suite.Error(err)
		suite.Nil(config)
	})

	suite.Run("CreateConfig Error when DB closed", func() {
		builder := schema.ServiceBuilderRailpack
		input := &MutateConfigInput{
			ServiceID: suite.testService.ID,
			Builder:   &builder,
		}

		suite.DB.Close()
		config, err := suite.serviceRepo.CreateConfig(suite.Ctx, nil, input)
		suite.Error(err)
		suite.Nil(config)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *ServiceMutationsSuite) TestUpdate() {
	suite.Run("Update Success", func() {
		newName := "Updated Service"
		newDescription := "Updated description"

		err := suite.serviceRepo.Update(suite.Ctx, nil, suite.testService.ID, &newName, &newDescription)
		suite.NoError(err)

		// Verify the update
		updated, err := suite.DB.Service.Get(suite.Ctx, suite.testService.ID)
		suite.NoError(err)
		suite.Equal("Updated Service", updated.Name)
		suite.Equal("Updated description", updated.Description)
	})

	suite.Run("Update Name Only", func() {
		newName := "Name Only Update"

		// Get original
		original := suite.DB.Service.GetX(suite.Ctx, suite.testService.ID)

		err := suite.serviceRepo.Update(suite.Ctx, nil, suite.testService.ID, &newName, nil)
		suite.NoError(err)

		// Verify the update
		updated, err := suite.DB.Service.Get(suite.Ctx, suite.testService.ID)
		suite.NoError(err)
		suite.Equal("Name Only Update", updated.Name)
		// Description should remain unchanged
		suite.Equal(original.Description, updated.Description)
	})

	suite.Run("Update Description Only", func() {
		newDescription := "Description Only Update"

		err := suite.serviceRepo.Update(suite.Ctx, nil, suite.testService.ID, nil, &newDescription)
		suite.NoError(err)

		// Verify the update
		updated, err := suite.DB.Service.Get(suite.Ctx, suite.testService.ID)
		suite.NoError(err)
		suite.Equal("Description Only Update", updated.Description)
	})

	suite.Run("Update Non-existent Service", func() {
		newName := "Non-existent"
		err := suite.serviceRepo.Update(suite.Ctx, nil, uuid.New(), &newName, nil)
		suite.NoError(err) // Update operations don't error on non-existent entities
	})

	suite.Run("Update Error when DB closed", func() {
		newName := "Closed DB"
		suite.DB.Close()
		err := suite.serviceRepo.Update(suite.Ctx, nil, suite.testService.ID, &newName, nil)
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *ServiceMutationsSuite) TestUpdateConfig() {
	suite.Run("UpdateConfig Success", func() {
		newBuilder := schema.ServiceBuilderDocker
		newReplicas := int32(5)
		newImage := "node:20"

		input := &MutateConfigInput{
			ServiceID: suite.testService.ID,
			Builder:   &newBuilder,
			Replicas:  &newReplicas,
			Image:     &newImage,
		}

		err := suite.serviceRepo.UpdateConfig(suite.Ctx, nil, input)
		suite.NoError(err)

		// Verify the update
		updated, err := suite.DB.ServiceConfig.Query().
			Where(serviceconfig.ServiceID(suite.testService.ID)).
			Only(suite.Ctx)
		suite.NoError(err)
		suite.Equal(schema.ServiceBuilderDocker, updated.Builder)
		suite.NotNil(updated.Replicas)
		suite.Equal(int32(5), updated.Replicas)
		suite.NotNil(updated.Image)
		suite.Equal("node:20", updated.Image)
	})

	suite.Run("UpdateConfig Add/Remove Ports", func() {
		input := &MutateConfigInput{
			ServiceID: suite.testService.ID,
			AddPorts: []schema.PortSpec{
				{Port: 8080, Protocol: utils.ToPtr(schema.ProtocolTCP)},
				{Port: 9090, Protocol: utils.ToPtr(schema.ProtocolTCP)},
			},
			RemovePorts: []schema.PortSpec{
				{Port: 3000, Protocol: utils.ToPtr(schema.ProtocolTCP)}, // Remove existing port
			},
		}

		err := suite.serviceRepo.UpdateConfig(suite.Ctx, nil, input)
		suite.NoError(err)

		// Verify the update
		updated, err := suite.DB.ServiceConfig.Query().
			Where(serviceconfig.ServiceID(suite.testService.ID)).
			Only(suite.Ctx)
		suite.NoError(err)
		suite.Len(updated.Ports, 2)

		portNumbers := make([]int32, len(updated.Ports))
		for i, port := range updated.Ports {
			portNumbers[i] = port.Port
		}
		suite.Contains(portNumbers, int32(8080))
		suite.Contains(portNumbers, int32(9090))
		suite.NotContains(portNumbers, int32(3000)) // Should be removed
	})

	suite.Run("UpdateConfig Add/Remove Hosts", func() {
		input := &MutateConfigInput{
			ServiceID: suite.testService.ID,
			UpsertHosts: []schema.HostSpec{
				{Host: "api.example.com", TargetPort: utils.ToPtr(int32(8080))},
				{Host: "admin.example.com", TargetPort: utils.ToPtr(int32(9090))},
			},
		}

		err := suite.serviceRepo.UpdateConfig(suite.Ctx, nil, input)
		suite.NoError(err)

		// Verify the update
		updated, err := suite.DB.ServiceConfig.Query().
			Where(serviceconfig.ServiceID(suite.testService.ID)).
			Only(suite.Ctx)
		suite.NoError(err)
		suite.Len(updated.Hosts, 2)

		hostNames := make([]string, len(updated.Hosts))
		for i, host := range updated.Hosts {
			hostNames[i] = host.Host
		}
		suite.Contains(hostNames, "api.example.com")
		suite.Contains(hostNames, "admin.example.com")

		// Test upsert behavior: update existing host with new port
		input2 := &MutateConfigInput{
			ServiceID: suite.testService.ID,
			AddPorts: []schema.PortSpec{
				{Port: 3000, Protocol: utils.ToPtr(schema.ProtocolTCP)}, // New port
			},
			UpsertHosts: []schema.HostSpec{
				{Host: "api.example.com", TargetPort: utils.ToPtr(int32(3000))},     // Changed port
				{Host: "newhost.example.com", TargetPort: utils.ToPtr(int32(3000))}, // New host
			},
		}

		// Pass the updated config from the first call as existingConfig
		err = suite.serviceRepo.UpdateConfig(suite.Ctx, nil, input2)
		suite.NoError(err)

		// Verify upsert behavior: should still have 2 hosts, but api.example.com should have updated port
		updated2, err := suite.DB.ServiceConfig.Query().
			Where(serviceconfig.ServiceID(suite.testService.ID)).
			Only(suite.Ctx)
		suite.NoError(err)
		suite.Len(updated2.Hosts, 3) // Should still be 2 hosts, not 3

		// Verify the port was updated for api.example.com
		var apiHost *schema.HostSpec
		var newHost *schema.HostSpec
		for _, host := range updated2.Hosts {
			if host.Host == "api.example.com" {
				apiHost = &host
			}
			if host.Host == "newhost.example.com" {
				newHost = &host
			}
			if newHost != nil && apiHost != nil {
				break // Both hosts found, no need to continue
			}
		}
		suite.NotNil(apiHost, "api.example.com host should exist")
		suite.NotNil(apiHost.TargetPort, "TargetPort should not be nil")
		suite.Equal(int32(3000), *apiHost.TargetPort, "Port should be updated to 3000")

		suite.NotNil(newHost, "newhost.example.com host should exist")
		suite.NotNil(newHost.TargetPort, "TargetPort for new host should not be nil")
		suite.Equal(int32(3000), *newHost.TargetPort, "New host port should be 3000")
		suite.Equal("newhost.example.com", newHost.Host, "New host should be newhost.example.com")

		// Verify admin.example.com is unchanged
		var adminHost *schema.HostSpec
		for _, host := range updated2.Hosts {
			if host.Host == "admin.example.com" {
				adminHost = &host
				break
			}
		}
		suite.NotNil(adminHost, "admin.example.com host should exist")
		suite.NotNil(adminHost.TargetPort, "TargetPort should not be nil")
		suite.Equal(int32(9090), *adminHost.TargetPort, "Port should remain unchanged at 9090")

		// Test changing a host/upserting
		input3 := &MutateConfigInput{
			ServiceID: suite.testService.ID,
			UpsertHosts: []schema.HostSpec{
				{PrevHost: utils.ToPtr("api.example.com"), Host: "api2.example.com", TargetPort: utils.ToPtr(int32(3000))}, // Changed port
			},
		}
		err = suite.serviceRepo.UpdateConfig(suite.Ctx, nil, input3)
		suite.NoError(err)
		// Verify api.example.com was changed to api2.example.com
		updated3, err := suite.DB.ServiceConfig.Query().
			Where(serviceconfig.ServiceID(suite.testService.ID)).
			Only(suite.Ctx)
		suite.NoError(err)
		suite.Len(updated3.Hosts, 3) // Should still be 3 hosts
		var api2Host *schema.HostSpec
		for _, host := range updated3.Hosts {
			if host.Host == "api2.example.com" {
				api2Host = &host
			}
			if host.Host == "api.example.com" {
				suite.Fail("api.example.com should have been updated to api2.example.com")
			}
		}
		suite.NotNil(api2Host, "api2.example.com host should exist")
		suite.NotNil(api2Host.TargetPort, "TargetPort for api2.example.com should not be nil")
		suite.Equal(int32(3000), *api2Host.TargetPort, "Port for api2.example.com should be 3000")
		suite.Equal("api2.example.com", api2Host.Host, "Host should be updated to api2.example.com")
	})

	suite.Run("UpdateConfig Resources", func() {
		resources := &schema.Resources{
			CPULimitsMillicores:     2000,
			CPURequestsMillicores:   1000,
			MemoryLimitsMegabytes:   1024,
			MemoryRequestsMegabytes: 512,
		}

		input := &MutateConfigInput{
			ServiceID: suite.testService.ID,
			Resources: resources,
		}

		err := suite.serviceRepo.UpdateConfig(suite.Ctx, nil, input)
		suite.NoError(err)

		// Verify the update
		updated, err := suite.DB.ServiceConfig.Query().
			Where(serviceconfig.ServiceID(suite.testService.ID)).
			Only(suite.Ctx)
		suite.NoError(err)
		suite.NotNil(updated.Resources)
		suite.Equal(int64(2000), updated.Resources.CPULimitsMillicores)
		suite.Equal(int64(1000), updated.Resources.CPURequestsMillicores)
		suite.Equal(int64(1024), updated.Resources.MemoryLimitsMegabytes)
		suite.Equal(int64(512), updated.Resources.MemoryRequestsMegabytes)
	})

	suite.Run("UpdateConfig Clear Resources", func() {
		// First set resources
		resources := &schema.Resources{
			CPULimitsMillicores:     0,
			CPURequestsMillicores:   0,
			MemoryLimitsMegabytes:   0,
			MemoryRequestsMegabytes: 0,
		}

		input := &MutateConfigInput{
			ServiceID: suite.testService.ID,
			Resources: resources,
		}

		err := suite.serviceRepo.UpdateConfig(suite.Ctx, nil, input)
		suite.NoError(err)

		// Verify resources are cleared
		updated, err := suite.DB.ServiceConfig.Query().
			Where(serviceconfig.ServiceID(suite.testService.ID)).
			Only(suite.Ctx)
		suite.NoError(err)
		suite.Nil(updated.Resources)
	})

	suite.Run("UpdateConfig Error when DB closed", func() {
		input := &MutateConfigInput{
			ServiceID: suite.testService.ID,
		}

		suite.DB.Close()
		err := suite.serviceRepo.UpdateConfig(suite.Ctx, nil, input)
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *ServiceMutationsSuite) TestDelete() {
	suite.Run("Delete Success", func() {
		// Create a service to delete
		serviceToDelete := suite.DB.Service.Create().
			SetType(schema.ServiceTypeGithub).
			SetKubernetesName("delete-test").
			SetName("Delete Test").
			SetDescription("Service to be deleted").
			SetEnvironmentID(suite.testEnvironment.ID).
			SetKubernetesSecret("delete-test-secret").
			SaveX(suite.Ctx)

		err := suite.serviceRepo.Delete(suite.Ctx, nil, serviceToDelete.ID)
		suite.NoError(err)

		// Verify the service is deleted
		_, err = suite.DB.Service.Get(suite.Ctx, serviceToDelete.ID)
		suite.Error(err)
	})

	suite.Run("Delete Non-existent Service", func() {
		err := suite.serviceRepo.Delete(suite.Ctx, nil, uuid.New())
		suite.Error(err)
		suite.True(ent.IsNotFound(err))
	})

	suite.Run("Delete Error when DB closed", func() {
		suite.DB.Close()
		err := suite.serviceRepo.Delete(suite.Ctx, nil, suite.testService.ID)
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *ServiceMutationsSuite) TestSetCurrentDeployment() {
	suite.Run("SetCurrentDeployment Success", func() {
		err := suite.serviceRepo.SetCurrentDeployment(suite.Ctx, nil, suite.testService.ID, suite.testDeployment.ID)
		suite.NoError(err)

		// Verify the update
		updated, err := suite.DB.Service.Get(suite.Ctx, suite.testService.ID)
		suite.NoError(err)
		suite.NotNil(updated.CurrentDeploymentID)
		suite.Equal(suite.testDeployment.ID, *updated.CurrentDeploymentID)
	})

	suite.Run("SetCurrentDeployment Non-existent Service", func() {
		err := suite.serviceRepo.SetCurrentDeployment(suite.Ctx, nil, uuid.New(), suite.testDeployment.ID)
		suite.Error(err)
		suite.True(ent.IsNotFound(err))
	})

	suite.Run("SetCurrentDeployment Error when DB closed", func() {
		suite.DB.Close()
		err := suite.serviceRepo.SetCurrentDeployment(suite.Ctx, nil, suite.testService.ID, suite.testDeployment.ID)
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *ServiceMutationsSuite) TestUpdateVariableMounts() {
	suite.Run("UpdateVariableMounts Success", func() {
		variableMounts := []*schema.VariableMount{
			{
				Name: "DATABASE_URL",
				Path: "/etc/config/database.url",
			},
			{
				Name: "API_KEY",
				Path: "/etc/config/api.key",
			},
		}

		err := suite.serviceRepo.UpdateVariableMounts(suite.Ctx, nil, suite.testService.ID, variableMounts)
		suite.NoError(err)

		// Verify the update
		updated, err := suite.DB.ServiceConfig.Query().
			Where(serviceconfig.ServiceID(suite.testService.ID)).
			Only(suite.Ctx)
		suite.NoError(err)
		suite.Len(updated.VariableMounts, 2)

		mountNames := make([]string, len(updated.VariableMounts))
		for i, mount := range updated.VariableMounts {
			mountNames[i] = mount.Name
		}
		suite.Contains(mountNames, "DATABASE_URL")
		suite.Contains(mountNames, "API_KEY")
	})

	suite.Run("UpdateVariableMounts Empty List", func() {
		err := suite.serviceRepo.UpdateVariableMounts(suite.Ctx, nil, suite.testService.ID, []*schema.VariableMount{})
		suite.NoError(err)

		// Verify the update
		updated, err := suite.DB.ServiceConfig.Query().
			Where(serviceconfig.ServiceID(suite.testService.ID)).
			Only(suite.Ctx)
		suite.NoError(err)
		suite.Len(updated.VariableMounts, 0)
	})

	suite.Run("UpdateVariableMounts Error when DB closed", func() {
		suite.DB.Close()
		err := suite.serviceRepo.UpdateVariableMounts(suite.Ctx, nil, suite.testService.ID, []*schema.VariableMount{})
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *ServiceMutationsSuite) TestUpdateDatabaseStorageSize() {
	suite.Run("UpdateDatabaseStorageSize Success", func() {
		// First set a database config
		databaseConfig := &schema.DatabaseConfig{
			StorageSize: "10Gi",
			Version:     "14",
		}
		suite.DB.ServiceConfig.UpdateOneID(suite.testConfig.ID).
			SetDatabaseConfig(databaseConfig).
			SaveX(suite.Ctx)

		newConfig, err := suite.serviceRepo.UpdateDatabaseStorageSize(suite.Ctx, nil, suite.testService.ID, "20Gi")
		suite.NoError(err)
		suite.NotNil(newConfig)
		suite.Equal("20Gi", newConfig.StorageSize)
		suite.Equal("14", newConfig.Version) // Should preserve other fields
	})

	suite.Run("UpdateDatabaseStorageSize Auto Add Gi Suffix", func() {
		newConfig, err := suite.serviceRepo.UpdateDatabaseStorageSize(suite.Ctx, nil, suite.testService.ID, "50")
		suite.NoError(err)
		suite.NotNil(newConfig)
		suite.Equal("50Gi", newConfig.StorageSize) // Should auto-add Gi suffix
	})

	suite.Run("UpdateDatabaseStorageSize Create New Config", func() {
		// Create service without database config
		service := suite.DB.Service.Create().
			SetType(schema.ServiceTypeDatabase).
			SetKubernetesName("no-config-service").
			SetName("No Config Service").
			SetDescription("Service without config").
			SetEnvironmentID(suite.testEnvironment.ID).
			SetKubernetesSecret("no-config-secret").
			SaveX(suite.Ctx)

		config := suite.DB.ServiceConfig.Create().
			SetServiceID(service.ID).
			SetBuilder(schema.ServiceBuilderRailpack).
			SetIcon("database").
			SaveX(suite.Ctx)

		newConfig, err := suite.serviceRepo.UpdateDatabaseStorageSize(suite.Ctx, nil, service.ID, "15Gi")
		suite.NoError(err)
		suite.NotNil(newConfig)
		suite.Equal("15Gi", newConfig.StorageSize)

		// Verify it was saved
		updated, err := suite.DB.ServiceConfig.Get(suite.Ctx, config.ID)
		suite.NoError(err)
		suite.NotNil(updated.DatabaseConfig)
		suite.Equal("15Gi", updated.DatabaseConfig.StorageSize)
	})

	suite.Run("UpdateDatabaseStorageSize Non-existent Service", func() {
		_, err := suite.serviceRepo.UpdateDatabaseStorageSize(suite.Ctx, nil, uuid.New(), "10Gi")
		suite.Error(err)
	})

	suite.Run("UpdateDatabaseStorageSize Error when DB closed", func() {
		suite.DB.Close()
		_, err := suite.serviceRepo.UpdateDatabaseStorageSize(suite.Ctx, nil, suite.testService.ID, "10Gi")
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func TestServiceMutationsSuite(t *testing.T) {
	suite.Run(t, new(ServiceMutationsSuite))
}
