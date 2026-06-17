package servicegroup_repo

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/ent/service"
	"github.com/unbindapp/unbind-api/ent/servicegroup"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	"github.com/unbindapp/unbind-api/internal/models"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	"golang.org/x/crypto/bcrypt"
)

type ServiceGroupMutationsSuite struct {
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

func (suite *ServiceGroupMutationsSuite) SetupTest() {
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

	// Create test services
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

func (suite *ServiceGroupMutationsSuite) TearDownTest() {
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

func (suite *ServiceGroupMutationsSuite) TestCreate() {
	suite.Run("Create Success", func() {
		serviceGroup, err := suite.serviceGroupRepo.Create(
			suite.Ctx,
			nil,
			"New Service Group",
			utils.ToPtr("group"),
			utils.ToPtr("New service group description"),
			suite.testEnvironment.ID,
		)

		suite.NoError(err)
		suite.NotNil(serviceGroup)
		suite.Equal("New Service Group", serviceGroup.Name)
		suite.NotNil(serviceGroup.Icon)
		suite.Equal("group", *serviceGroup.Icon)
		suite.NotNil(serviceGroup.Description)
		suite.Equal("New service group description", *serviceGroup.Description)
		suite.Equal(suite.testEnvironment.ID, serviceGroup.EnvironmentID)
	})

	suite.Run("Create With Minimal Fields", func() {
		serviceGroup, err := suite.serviceGroupRepo.Create(
			suite.Ctx,
			nil,
			"Minimal Service Group",
			nil,
			nil,
			suite.testEnvironment.ID,
		)

		suite.NoError(err)
		suite.NotNil(serviceGroup)
		suite.Equal("Minimal Service Group", serviceGroup.Name)
		suite.Nil(serviceGroup.Icon)
		suite.Nil(serviceGroup.Description)
		suite.Equal(suite.testEnvironment.ID, serviceGroup.EnvironmentID)
	})

	suite.Run("Create With Empty Optional Fields", func() {
		serviceGroup, err := suite.serviceGroupRepo.Create(
			suite.Ctx,
			nil,
			"Empty Optional Fields",
			utils.ToPtr(""),
			utils.ToPtr(""),
			suite.testEnvironment.ID,
		)

		suite.NoError(err)
		suite.NotNil(serviceGroup)
		suite.Equal("Empty Optional Fields", serviceGroup.Name)
		suite.NotNil(serviceGroup.Icon)
		suite.Equal("", *serviceGroup.Icon)
		suite.NotNil(serviceGroup.Description)
		suite.Equal("", *serviceGroup.Description)
	})

	suite.Run("Create Non-existent Environment", func() {
		_, err := suite.serviceGroupRepo.Create(
			suite.Ctx,
			nil,
			"Invalid Service Group",
			nil,
			nil,
			uuid.New(),
		)

		suite.Error(err)
	})

	suite.Run("Create Error when DB closed", func() {
		suite.DB.Close()
		_, err := suite.serviceGroupRepo.Create(
			suite.Ctx,
			nil,
			"Closed DB Service Group",
			nil,
			nil,
			suite.testEnvironment.ID,
		)

		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *ServiceGroupMutationsSuite) TestUpdate() {
	suite.Run("Update All Fields", func() {
		input := &models.UpdateServiceGroupInput{
			ID:          suite.testServiceGroup.ID,
			Name:        utils.ToPtr("Updated Service Group"),
			Icon:        utils.ToPtr("updated-icon"),
			Description: utils.ToPtr("Updated description"),
		}

		serviceGroup, err := suite.serviceGroupRepo.Update(suite.Ctx, input)
		suite.NoError(err)
		suite.NotNil(serviceGroup)
		suite.Equal("Updated Service Group", serviceGroup.Name)
		suite.NotNil(serviceGroup.Icon)
		suite.Equal("updated-icon", *serviceGroup.Icon)
		suite.NotNil(serviceGroup.Description)
		suite.Equal("Updated description", *serviceGroup.Description)
	})

	suite.Run("Update Name Only", func() {
		// Get original values
		original, err := suite.DB.ServiceGroup.Get(suite.Ctx, suite.testServiceGroup.ID)
		suite.NoError(err)

		input := &models.UpdateServiceGroupInput{
			ID:   suite.testServiceGroup.ID,
			Name: utils.ToPtr("Name Only Update"),
		}

		serviceGroup, err := suite.serviceGroupRepo.Update(suite.Ctx, input)
		suite.NoError(err)
		suite.NotNil(serviceGroup)
		suite.Equal("Name Only Update", serviceGroup.Name)

		// Other fields should remain unchanged
		if original.Icon != nil {
			suite.NotNil(serviceGroup.Icon)
			suite.Equal(*original.Icon, *serviceGroup.Icon)
		}
		if original.Description != nil {
			suite.NotNil(serviceGroup.Description)
			suite.Equal(*original.Description, *serviceGroup.Description)
		}
	})

	suite.Run("Update Clear Icon", func() {
		input := &models.UpdateServiceGroupInput{
			ID:   suite.testServiceGroup.ID,
			Icon: utils.ToPtr(""),
		}

		serviceGroup, err := suite.serviceGroupRepo.Update(suite.Ctx, input)
		suite.NoError(err)
		suite.NotNil(serviceGroup)
		suite.Nil(serviceGroup.Icon)
	})

	suite.Run("Update Clear Description", func() {
		input := &models.UpdateServiceGroupInput{
			ID:          suite.testServiceGroup.ID,
			Description: utils.ToPtr(""),
		}

		serviceGroup, err := suite.serviceGroupRepo.Update(suite.Ctx, input)
		suite.NoError(err)
		suite.NotNil(serviceGroup)
		suite.Nil(serviceGroup.Description)
	})

	suite.Run("Update Add Services", func() {
		input := &models.UpdateServiceGroupInput{
			ID:            suite.testServiceGroup.ID,
			AddServiceIDs: []uuid.UUID{suite.testService2.ID},
		}

		serviceGroup, err := suite.serviceGroupRepo.Update(suite.Ctx, input)
		suite.NoError(err)
		suite.NotNil(serviceGroup)

		// Verify service was added
		services, err := suite.DB.Service.Query().
			Where(service.ServiceGroupID(suite.testServiceGroup.ID)).
			All(suite.Ctx)
		suite.NoError(err)
		suite.Len(services, 2) // service1 was already in the group, service2 was added

		serviceIDs := []uuid.UUID{services[0].ID, services[1].ID}
		suite.Contains(serviceIDs, suite.testService1.ID)
		suite.Contains(serviceIDs, suite.testService2.ID)
	})

	suite.Run("Update Remove Services", func() {
		input := &models.UpdateServiceGroupInput{
			ID:               suite.testServiceGroup.ID,
			RemoveServiceIDs: []uuid.UUID{suite.testService1.ID},
		}

		serviceGroup, err := suite.serviceGroupRepo.Update(suite.Ctx, input)
		suite.NoError(err)
		suite.NotNil(serviceGroup)

		// Verify service was removed
		services, err := suite.DB.Service.Query().
			Where(service.ServiceGroupID(suite.testServiceGroup.ID)).
			All(suite.Ctx)
		suite.NoError(err)
		suite.Len(services, 1) // Only service2 should remain
		suite.Equal(suite.testService2.ID, services[0].ID)

		// Verify removed service no longer has service group
		removedService, err := suite.DB.Service.Get(suite.Ctx, suite.testService1.ID)
		suite.NoError(err)
		suite.Nil(removedService.ServiceGroupID)
	})

	suite.Run("Update Add and Remove Services", func() {
		// Create another service to add
		service3 := suite.DB.Service.Create().
			SetType(schema.ServiceTypeGithub).
			SetKubernetesName("test-service-3").
			SetName("Test Service 3").
			SetEnvironmentID(suite.testEnvironment.ID).
			SetKubernetesSecret("test-service-3-secret").
			SaveX(suite.Ctx)

		input := &models.UpdateServiceGroupInput{
			ID:               suite.testServiceGroup.ID,
			AddServiceIDs:    []uuid.UUID{service3.ID},
			RemoveServiceIDs: []uuid.UUID{suite.testService2.ID},
		}

		serviceGroup, err := suite.serviceGroupRepo.Update(suite.Ctx, input)
		suite.NoError(err)
		suite.NotNil(serviceGroup)

		// Verify changes
		services, err := suite.DB.Service.Query().
			Where(service.ServiceGroupID(suite.testServiceGroup.ID)).
			All(suite.Ctx)
		suite.NoError(err)
		suite.Len(services, 1) // Should have service3 only
		suite.Equal(service3.ID, services[0].ID)
	})

	suite.Run("Update Non-existent Service Group", func() {
		input := &models.UpdateServiceGroupInput{
			ID:   uuid.New(),
			Name: utils.ToPtr("Non-existent"),
		}

		_, err := suite.serviceGroupRepo.Update(suite.Ctx, input)
		suite.Error(err)
		suite.True(ent.IsNotFound(err))
	})

	suite.Run("Update Error when DB closed", func() {
		input := &models.UpdateServiceGroupInput{
			ID:   suite.testServiceGroup.ID,
			Name: utils.ToPtr("Closed DB"),
		}

		suite.DB.Close()
		_, err := suite.serviceGroupRepo.Update(suite.Ctx, input)
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *ServiceGroupMutationsSuite) TestDelete() {
	suite.Run("Delete Success", func() {
		// Create a service group to delete
		serviceGroupToDelete := suite.DB.ServiceGroup.Create().
			SetName("Delete Test Group").
			SetEnvironmentID(suite.testEnvironment.ID).
			SaveX(suite.Ctx)

		// Create a service in this group
		serviceInGroup := suite.DB.Service.Create().
			SetType(schema.ServiceTypeGithub).
			SetKubernetesName("service-in-group").
			SetName("Service In Group").
			SetEnvironmentID(suite.testEnvironment.ID).
			SetServiceGroupID(serviceGroupToDelete.ID).
			SetKubernetesSecret("service-in-group-secret").
			SaveX(suite.Ctx)

		err := suite.serviceGroupRepo.Delete(suite.Ctx, nil, serviceGroupToDelete.ID)
		suite.NoError(err)

		// Verify service group is deleted
		_, err = suite.DB.ServiceGroup.Get(suite.Ctx, serviceGroupToDelete.ID)
		suite.Error(err)
		suite.True(ent.IsNotFound(err))

		// Verify service's service group reference is cleared
		updatedService, err := suite.DB.Service.Get(suite.Ctx, serviceInGroup.ID)
		suite.NoError(err)
		suite.Nil(updatedService.ServiceGroupID)
	})

	suite.Run("Delete Non-existent Service Group", func() {
		err := suite.serviceGroupRepo.Delete(suite.Ctx, nil, uuid.New())
		suite.Error(err)
		suite.True(ent.IsNotFound(err))
	})

	suite.Run("Delete Error when DB closed", func() {
		suite.DB.Close()
		err := suite.serviceGroupRepo.Delete(suite.Ctx, nil, suite.testServiceGroup.ID)
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *ServiceGroupMutationsSuite) TestDeleteByEnvironmentID() {
	suite.Run("DeleteByEnvironmentID Success", func() {
		// Create additional service groups in the same environment
		serviceGroup2 := suite.DB.ServiceGroup.Create().
			SetName("Service Group 2").
			SetEnvironmentID(suite.testEnvironment.ID).
			SaveX(suite.Ctx)

		serviceGroup3 := suite.DB.ServiceGroup.Create().
			SetName("Service Group 3").
			SetEnvironmentID(suite.testEnvironment.ID).
			SaveX(suite.Ctx)

		// Create a service group in a different environment
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

		err := suite.serviceGroupRepo.DeleteByEnvironmentID(suite.Ctx, nil, suite.testEnvironment.ID)
		suite.NoError(err)

		// Verify all service groups in the environment are deleted
		serviceGroups, err := suite.DB.ServiceGroup.Query().
			Where(servicegroup.EnvironmentID(suite.testEnvironment.ID)).
			All(suite.Ctx)
		suite.NoError(err)
		suite.Len(serviceGroups, 0)

		// Verify service group in other environment still exists
		_, err = suite.DB.ServiceGroup.Get(suite.Ctx, otherServiceGroup.ID)
		suite.NoError(err)

		// Use variables to avoid unused warnings
		suite.NotEqual(serviceGroup2.ID, uuid.Nil)
		suite.NotEqual(serviceGroup3.ID, uuid.Nil)
	})

	suite.Run("DeleteByEnvironmentID No Service Groups", func() {
		// Create empty environment
		emptyEnv := suite.DB.Environment.Create().
			SetKubernetesName("empty-env").
			SetName("Empty Environment").
			SetProjectID(suite.testProject.ID).
			SetKubernetesSecret("empty-env-secret").
			SaveX(suite.Ctx)

		err := suite.serviceGroupRepo.DeleteByEnvironmentID(suite.Ctx, nil, emptyEnv.ID)
		suite.NoError(err) // Should succeed even with no service groups to delete
	})

	suite.Run("DeleteByEnvironmentID Non-existent Environment", func() {
		err := suite.serviceGroupRepo.DeleteByEnvironmentID(suite.Ctx, nil, uuid.New())
		suite.NoError(err) // Should succeed even with non-existent environment
	})

	suite.Run("DeleteByEnvironmentID Error when DB closed", func() {
		suite.DB.Close()
		err := suite.serviceGroupRepo.DeleteByEnvironmentID(suite.Ctx, nil, suite.testEnvironment.ID)
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func TestServiceGroupMutationsSuite(t *testing.T) {
	suite.Run(t, new(ServiceGroupMutationsSuite))
}
