package servicegroup_repo

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	"golang.org/x/crypto/bcrypt"
)

type ServiceGroupQueriesSuite struct {
	repository.RepositoryBaseSuite
	serviceGroupRepo *ServiceGroupRepository
	testUser         *ent.User
	testTeam         *ent.Team
	testProject      *ent.Project
	testEnvironment  *ent.Environment
	testServiceGroup *ent.ServiceGroup
	testService1     *ent.Service
	testService2     *ent.Service
}

func (suite *ServiceGroupQueriesSuite) SetupTest() {
	suite.RepositoryBaseSuite.SetupTest()
	suite.serviceGroupRepo = NewServiceGroupRepository(suite.DB)

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

	// Create test service group
	suite.testServiceGroup = suite.DB.ServiceGroup.Create().
		SetName("Test Service Group").
		SetIcon("folder").
		SetDescription("Test service group description").
		SetEnvironmentID(suite.testEnvironment.ID).
		SaveX(suite.Ctx)

	// Create test services - service1 in the group, service2 not in group
	suite.testService1 = suite.DB.Service.Create().
		SetType(schema.ServiceTypeGithub).
		SetKubernetesName("test-service-1").
		SetName("Test Service 1").
		SetDescription("Test service 1 description").
		SetEnvironmentID(suite.testEnvironment.ID).
		SetServiceGroupID(suite.testServiceGroup.ID).
		SetKubernetesSecret("test-service-1-secret").
		SetDetectedPorts([]schema.PortSpec{
			{Port: 3000, Protocol: utils.ToPtr(schema.ProtocolTCP)},
		}).
		SaveX(suite.Ctx)

	suite.testService2 = suite.DB.Service.Create().
		SetType(schema.ServiceTypeGithub).
		SetKubernetesName("test-service-2").
		SetName("Test Service 2").
		SetDescription("Test service 2 description").
		SetEnvironmentID(suite.testEnvironment.ID).
		SetKubernetesSecret("test-service-2-secret").
		SetDetectedPorts([]schema.PortSpec{
			{Port: 4000, Protocol: utils.ToPtr(schema.ProtocolTCP)},
		}).
		SaveX(suite.Ctx)
}

func (suite *ServiceGroupQueriesSuite) TearDownTest() {
	suite.RepositoryBaseSuite.TearDownTest()
	suite.serviceGroupRepo = nil
	suite.testUser = nil
	suite.testTeam = nil
	suite.testProject = nil
	suite.testEnvironment = nil
	suite.testServiceGroup = nil
	suite.testService1 = nil
	suite.testService2 = nil
}

func (suite *ServiceGroupQueriesSuite) TestGetByID() {
	suite.Run("GetByID Success", func() {
		serviceGroup, err := suite.serviceGroupRepo.GetByID(suite.Ctx, suite.testServiceGroup.ID)
		suite.NoError(err)
		suite.NotNil(serviceGroup)
		suite.Equal(suite.testServiceGroup.ID, serviceGroup.ID)
		suite.Equal("Test Service Group", serviceGroup.Name)
		suite.NotNil(serviceGroup.Icon)
		suite.Equal("folder", *serviceGroup.Icon)
		suite.NotNil(serviceGroup.Description)
		suite.Equal("Test service group description", *serviceGroup.Description)
		suite.Equal(suite.testEnvironment.ID, serviceGroup.EnvironmentID)
	})

	suite.Run("GetByID Non-existent Service Group", func() {
		_, err := suite.serviceGroupRepo.GetByID(suite.Ctx, uuid.New())
		suite.Error(err)
		suite.True(ent.IsNotFound(err))
	})

	suite.Run("GetByID Error when DB closed", func() {
		suite.DB.Close()
		_, err := suite.serviceGroupRepo.GetByID(suite.Ctx, suite.testServiceGroup.ID)
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *ServiceGroupQueriesSuite) TestGetByEnvironmentID() {
	suite.Run("GetByEnvironmentID Success", func() {
		// Create additional service groups in the same environment
		serviceGroup2 := suite.DB.ServiceGroup.Create().
			SetName("Service Group 2").
			SetIcon("group").
			SetDescription("Second service group").
			SetEnvironmentID(suite.testEnvironment.ID).
			SaveX(suite.Ctx)

		serviceGroup3 := suite.DB.ServiceGroup.Create().
			SetName("Service Group 3").
			SetIcon("cluster").
			SetEnvironmentID(suite.testEnvironment.ID).
			SaveX(suite.Ctx)

		serviceGroups, err := suite.serviceGroupRepo.GetByEnvironmentID(suite.Ctx, suite.testEnvironment.ID)
		suite.NoError(err)
		suite.GreaterOrEqual(len(serviceGroups), 3)

		// Verify all returned service groups belong to the correct environment
		for _, sg := range serviceGroups {
			suite.Equal(suite.testEnvironment.ID, sg.EnvironmentID)
		}

		// Check ordering (most recent first)
		if len(serviceGroups) >= 2 {
			suite.True(serviceGroups[0].CreatedAt.After(serviceGroups[1].CreatedAt) ||
				serviceGroups[0].CreatedAt.Equal(serviceGroups[1].CreatedAt))
		}

		// Find our test service groups
		foundGroups := make(map[uuid.UUID]bool)
		for _, sg := range serviceGroups {
			foundGroups[sg.ID] = true
		}
		suite.True(foundGroups[suite.testServiceGroup.ID])
		suite.True(foundGroups[serviceGroup2.ID])
		suite.True(foundGroups[serviceGroup3.ID])
	})

	suite.Run("GetByEnvironmentID Different Environment", func() {
		// Create another environment with service groups
		otherEnv := suite.DB.Environment.Create().
			SetKubernetesName("other-env").
			SetName("Other Environment").
			SetProjectID(suite.testProject.ID).
			SetKubernetesSecret("other-env-secret").
			SaveX(suite.Ctx)

		otherServiceGroup := suite.DB.ServiceGroup.Create().
			SetName("Other Service Group").
			SetEnvironmentID(otherEnv.ID).
			SaveX(suite.Ctx)

		// Query for service groups in the other environment
		serviceGroups, err := suite.serviceGroupRepo.GetByEnvironmentID(suite.Ctx, otherEnv.ID)
		suite.NoError(err)
		suite.Len(serviceGroups, 1)
		suite.Equal(otherServiceGroup.ID, serviceGroups[0].ID)
		suite.Equal(otherEnv.ID, serviceGroups[0].EnvironmentID)

		// Verify our test service group is not included
		for _, sg := range serviceGroups {
			suite.NotEqual(suite.testServiceGroup.ID, sg.ID)
		}
	})

	suite.Run("GetByEnvironmentID Empty Environment", func() {
		// Create environment with no service groups
		emptyEnv := suite.DB.Environment.Create().
			SetKubernetesName("empty-env").
			SetName("Empty Environment").
			SetProjectID(suite.testProject.ID).
			SetKubernetesSecret("empty-env-secret").
			SaveX(suite.Ctx)

		serviceGroups, err := suite.serviceGroupRepo.GetByEnvironmentID(suite.Ctx, emptyEnv.ID)
		suite.NoError(err)
		suite.Len(serviceGroups, 0)
	})

	suite.Run("GetByEnvironmentID Non-existent Environment", func() {
		serviceGroups, err := suite.serviceGroupRepo.GetByEnvironmentID(suite.Ctx, uuid.New())
		suite.NoError(err)
		suite.Len(serviceGroups, 0)
	})

	suite.Run("GetByEnvironmentID Error when DB closed", func() {
		suite.DB.Close()
		_, err := suite.serviceGroupRepo.GetByEnvironmentID(suite.Ctx, suite.testEnvironment.ID)
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *ServiceGroupQueriesSuite) TestGetServices() {
	suite.Run("GetServices with one service", func() {
		services, err := suite.serviceGroupRepo.GetServices(suite.Ctx, suite.testServiceGroup.ID)
		suite.NoError(err)
		suite.Len(services, 1)
		suite.Equal(suite.testService1.ID, services[0].ID)
		suite.Equal(suite.testServiceGroup.ID, *services[0].ServiceGroupID)
	})

	suite.Run("GetServices with multiple services", func() {
		// Add second service to the group
		suite.DB.Service.UpdateOneID(suite.testService2.ID).
			SetServiceGroupID(suite.testServiceGroup.ID).
			SaveX(suite.Ctx)

		services, err := suite.serviceGroupRepo.GetServices(suite.Ctx, suite.testServiceGroup.ID)
		suite.NoError(err)
		suite.Len(services, 2)

		// Both services should belong to the group
		for _, svc := range services {
			suite.Equal(suite.testServiceGroup.ID, *svc.ServiceGroupID)
		}

		// Clean up
		suite.DB.Service.UpdateOneID(suite.testService2.ID).
			ClearServiceGroup().
			SaveX(suite.Ctx)
	})

	suite.Run("GetServices with empty group", func() {
		emptyGroup := suite.DB.ServiceGroup.Create().
			SetName("Empty Group").
			SetEnvironmentID(suite.testEnvironment.ID).
			SaveX(suite.Ctx)

		services, err := suite.serviceGroupRepo.GetServices(suite.Ctx, emptyGroup.ID)
		suite.NoError(err)
		suite.Len(services, 0)
	})

	suite.Run("GetServices with non-existent group", func() {
		services, err := suite.serviceGroupRepo.GetServices(suite.Ctx, uuid.New())
		suite.NoError(err)
		suite.Len(services, 0)
	})
}

func TestServiceGroupQueriesSuite(t *testing.T) {
	suite.Run(t, new(ServiceGroupQueriesSuite))
}
