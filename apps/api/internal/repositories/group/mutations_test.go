package group_repo

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/group"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	deployment_repo "github.com/unbindapp/unbind-api/internal/repositories/deployment"
	environment_repo "github.com/unbindapp/unbind-api/internal/repositories/environment"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
	project_repo "github.com/unbindapp/unbind-api/internal/repositories/project"
	service_repo "github.com/unbindapp/unbind-api/internal/repositories/service"
	team_repo "github.com/unbindapp/unbind-api/internal/repositories/team"
	user_repo "github.com/unbindapp/unbind-api/internal/repositories/user"
	"golang.org/x/crypto/bcrypt"
)

type GroupMutationsSuite struct {
	repository.RepositoryBaseSuite
	groupRepo       *GroupRepository
	permissionsRepo *permissions_repo.PermissionsRepository
	userRepo        *user_repo.UserRepository
	projectRepo     *project_repo.ProjectRepository
	environmentRepo *environment_repo.EnvironmentRepository
	serviceRepo     *service_repo.ServiceRepository
	teamRepo        *team_repo.TeamRepository
	deploymentRepo  *deployment_repo.DeploymentRepository
	testUser        *ent.User
	testUser2       *ent.User
	testGroup       *ent.Group
}

func (suite *GroupMutationsSuite) SetupTest() {
	suite.RepositoryBaseSuite.SetupTest()
	suite.userRepo = user_repo.NewUserRepository(suite.DB)
	suite.projectRepo = project_repo.NewProjectRepository(suite.DB)
	suite.environmentRepo = environment_repo.NewEnvironmentRepository(suite.DB)
	suite.deploymentRepo = deployment_repo.NewDeploymentRepository(suite.DB)
	suite.serviceRepo = service_repo.NewServiceRepository(suite.DB, suite.deploymentRepo)
	suite.teamRepo = team_repo.NewTeamRepository(suite.DB)
	suite.permissionsRepo = permissions_repo.NewPermissionsRepository(suite.DB, suite.userRepo, suite.projectRepo, suite.environmentRepo, suite.serviceRepo, suite.teamRepo)
	suite.groupRepo = NewGroupRepository(suite.DB, suite.permissionsRepo)

	// Create test users
	pwd, _ := bcrypt.GenerateFromPassword([]byte("test-password"), 1)
	suite.testUser = suite.DB.User.Create().
		SetEmail("test@example.com").
		SetPasswordHash(string(pwd)).
		SaveX(suite.Ctx)

	pwd2, _ := bcrypt.GenerateFromPassword([]byte("test-password-2"), 1)
	suite.testUser2 = suite.DB.User.Create().
		SetEmail("test2@example.com").
		SetPasswordHash(string(pwd2)).
		SaveX(suite.Ctx)

	// Create test group
	suite.testGroup = suite.DB.Group.Create().
		SetName("Test Group").
		SetDescription("Test group description").
		SaveX(suite.Ctx)
}

func (suite *GroupMutationsSuite) TearDownTest() {
	suite.RepositoryBaseSuite.TearDownTest()
	suite.groupRepo = nil
	suite.testUser = nil
	suite.testUser2 = nil
	suite.testGroup = nil
}

func (suite *GroupMutationsSuite) TestUpdateK8sRoleName() {
	suite.Run("UpdateK8sRoleName Success", func() {
		k8sRoleName := "test-k8s-role"
		err := suite.groupRepo.UpdateK8sRoleName(suite.Ctx, suite.testGroup, k8sRoleName)
		suite.NoError(err)

		// Verify the update was applied
		updated, err := suite.DB.Group.Get(suite.Ctx, suite.testGroup.ID)
		suite.NoError(err)
		suite.NotNil(updated.K8sRoleName)
		suite.Equal(k8sRoleName, *updated.K8sRoleName)
	})

	suite.Run("UpdateK8sRoleName Update Existing", func() {
		// First set a role name
		k8sRoleName1 := "first-k8s-role"
		err := suite.groupRepo.UpdateK8sRoleName(suite.Ctx, suite.testGroup, k8sRoleName1)
		suite.NoError(err)

		// Then update it
		k8sRoleName2 := "second-k8s-role"
		err = suite.groupRepo.UpdateK8sRoleName(suite.Ctx, suite.testGroup, k8sRoleName2)
		suite.NoError(err)

		// Verify the update was applied
		updated, err := suite.DB.Group.Get(suite.Ctx, suite.testGroup.ID)
		suite.NoError(err)
		suite.NotNil(updated.K8sRoleName)
		suite.Equal(k8sRoleName2, *updated.K8sRoleName)
	})

	suite.Run("UpdateK8sRoleName Non-existent Group", func() {
		nonExistentGroup := &ent.Group{ID: uuid.New()}
		err := suite.groupRepo.UpdateK8sRoleName(suite.Ctx, nonExistentGroup, "test-role")
		suite.Error(err)
	})

	suite.Run("UpdateK8sRoleName Error when DB closed", func() {
		suite.DB.Close()
		err := suite.groupRepo.UpdateK8sRoleName(suite.Ctx, suite.testGroup, "test-role")
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *GroupMutationsSuite) TestClearK8sRoleName() {
	suite.Run("ClearK8sRoleName Success", func() {
		// First set a role name
		k8sRoleName := "test-k8s-role"
		err := suite.groupRepo.UpdateK8sRoleName(suite.Ctx, suite.testGroup, k8sRoleName)
		suite.NoError(err)

		// Verify it was set
		updated, err := suite.DB.Group.Get(suite.Ctx, suite.testGroup.ID)
		suite.NoError(err)
		suite.NotNil(updated.K8sRoleName)
		suite.Equal(k8sRoleName, *updated.K8sRoleName)

		// Now clear it
		err = suite.groupRepo.ClearK8sRoleName(suite.Ctx, suite.testGroup)
		suite.NoError(err)

		// Verify it was cleared
		updated, err = suite.DB.Group.Get(suite.Ctx, suite.testGroup.ID)
		suite.NoError(err)
		suite.Nil(updated.K8sRoleName)
	})

	suite.Run("ClearK8sRoleName Already Null", func() {
		// Ensure K8sRoleName is null
		_, err := suite.DB.Group.UpdateOne(suite.testGroup).
			ClearK8sRoleName().
			Save(suite.Ctx)
		suite.NoError(err)

		// Clear it again - should not error
		err = suite.groupRepo.ClearK8sRoleName(suite.Ctx, suite.testGroup)
		suite.NoError(err)

		// Verify it's still null
		updated, err := suite.DB.Group.Get(suite.Ctx, suite.testGroup.ID)
		suite.NoError(err)
		suite.Nil(updated.K8sRoleName)
	})

	suite.Run("ClearK8sRoleName Non-existent Group", func() {
		nonExistentGroup := &ent.Group{ID: uuid.New()}
		err := suite.groupRepo.ClearK8sRoleName(suite.Ctx, nonExistentGroup)
		suite.Error(err)
	})

	suite.Run("ClearK8sRoleName Error when DB closed", func() {
		suite.DB.Close()
		err := suite.groupRepo.ClearK8sRoleName(suite.Ctx, suite.testGroup)
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *GroupMutationsSuite) TestAddUser() {
	suite.Run("AddUser Success", func() {
		// Remove user from group
		err := suite.groupRepo.RemoveUser(suite.Ctx, suite.testGroup.ID, suite.testUser.ID)
		suite.NoError(err)

		// Verify user is not in group
		updated, err := suite.DB.Group.Query().
			Where(group.IDEQ(suite.testGroup.ID)).
			WithUsers().
			Only(suite.Ctx)
		suite.NoError(err)
		suite.Len(updated.Edges.Users, 0)

		err = suite.groupRepo.AddUser(suite.Ctx, suite.testGroup.ID, suite.testUser.ID)
		suite.NoError(err)

		// Verify the user was added
		updated, err = suite.DB.Group.Query().
			Where(group.IDEQ(suite.testGroup.ID)).
			WithUsers().
			Only(suite.Ctx)
		suite.NoError(err)
		suite.Len(updated.Edges.Users, 1)
		suite.Equal(suite.testUser.ID, updated.Edges.Users[0].ID)
	})

	suite.Run("AddUser Multiple Users", func() {
		// Add first user
		err := suite.groupRepo.AddUser(suite.Ctx, suite.testGroup.ID, suite.testUser.ID)
		suite.NoError(err)

		// Add second user
		err = suite.groupRepo.AddUser(suite.Ctx, suite.testGroup.ID, suite.testUser2.ID)
		suite.NoError(err)

		// Verify both users were added
		updated, err := suite.DB.Group.Query().
			Where(group.IDEQ(suite.testGroup.ID)).
			WithUsers().
			Only(suite.Ctx)
		suite.NoError(err)
		suite.Len(updated.Edges.Users, 2)

		userIDs := make([]uuid.UUID, len(updated.Edges.Users))
		for i, user := range updated.Edges.Users {
			userIDs[i] = user.ID
		}
		suite.Contains(userIDs, suite.testUser.ID)
		suite.Contains(userIDs, suite.testUser2.ID)
	})

	suite.Run("AddUser Already Added", func() {
		// Clear any existing user from the group
		suite.DB.Group.Update().ClearUsers().ExecX(suite.Ctx)

		// Add user first time
		err := suite.groupRepo.AddUser(suite.Ctx, suite.testGroup.ID, suite.testUser.ID)
		suite.NoError(err)

		// Add same user again - should not error but also not duplicate
		err = suite.groupRepo.AddUser(suite.Ctx, suite.testGroup.ID, suite.testUser.ID)
		suite.NoError(err)

		// Verify only one instance of the user
		updated, err := suite.DB.Group.Query().
			Where(group.IDEQ(suite.testGroup.ID)).
			WithUsers().
			Only(suite.Ctx)
		suite.NoError(err)
		suite.Len(updated.Edges.Users, 1)
		suite.Equal(suite.testUser.ID, updated.Edges.Users[0].ID)
	})

	suite.Run("AddUser Non-existent Group", func() {
		nonExistentGroupID := uuid.New()
		err := suite.groupRepo.AddUser(suite.Ctx, nonExistentGroupID, suite.testUser.ID)
		suite.Error(err)
	})

	suite.Run("AddUser Non-existent User", func() {
		nonExistentUserID := uuid.New()
		err := suite.groupRepo.AddUser(suite.Ctx, suite.testGroup.ID, nonExistentUserID)
		suite.Error(err)
	})

	suite.Run("AddUser Error when DB closed", func() {
		suite.DB.Close()
		err := suite.groupRepo.AddUser(suite.Ctx, suite.testGroup.ID, suite.testUser.ID)
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *GroupMutationsSuite) TestRemoveUser() {
	suite.Run("RemoveUser Success", func() {
		// First add the user
		err := suite.groupRepo.AddUser(suite.Ctx, suite.testGroup.ID, suite.testUser.ID)
		suite.NoError(err)

		// Verify user was added
		updated, err := suite.DB.Group.Query().
			Where(group.IDEQ(suite.testGroup.ID)).
			WithUsers().
			Only(suite.Ctx)
		suite.NoError(err)
		suite.Len(updated.Edges.Users, 1)

		// Now remove the user
		err = suite.groupRepo.RemoveUser(suite.Ctx, suite.testGroup.ID, suite.testUser.ID)
		suite.NoError(err)

		// Verify user was removed
		updated, err = suite.DB.Group.Query().
			Where(group.IDEQ(suite.testGroup.ID)).
			WithUsers().
			Only(suite.Ctx)
		suite.NoError(err)
		suite.Len(updated.Edges.Users, 0)
	})

	suite.Run("RemoveUser One of Multiple Users", func() {
		// Add both users
		err := suite.groupRepo.AddUser(suite.Ctx, suite.testGroup.ID, suite.testUser.ID)
		suite.NoError(err)
		err = suite.groupRepo.AddUser(suite.Ctx, suite.testGroup.ID, suite.testUser2.ID)
		suite.NoError(err)

		// Verify both users were added
		updated, err := suite.DB.Group.Query().
			Where(group.IDEQ(suite.testGroup.ID)).
			WithUsers().
			Only(suite.Ctx)
		suite.NoError(err)
		suite.Len(updated.Edges.Users, 2)

		// Remove first user
		err = suite.groupRepo.RemoveUser(suite.Ctx, suite.testGroup.ID, suite.testUser.ID)
		suite.NoError(err)

		// Verify only second user remains
		updated, err = suite.DB.Group.Query().
			Where(group.IDEQ(suite.testGroup.ID)).
			WithUsers().
			Only(suite.Ctx)
		suite.NoError(err)
		suite.Len(updated.Edges.Users, 1)
		suite.Equal(suite.testUser2.ID, updated.Edges.Users[0].ID)
	})

	suite.Run("RemoveUser Not in Group", func() {
		// Clear any existing users from the group
		suite.DB.Group.Update().ClearUsers().ExecX(suite.Ctx)

		// Try to remove a user that's not in the group - should not error
		err := suite.groupRepo.RemoveUser(suite.Ctx, suite.testGroup.ID, suite.testUser.ID)
		suite.NoError(err)

		// Verify group is still empty
		updated, err := suite.DB.Group.Query().
			Where(group.IDEQ(suite.testGroup.ID)).
			WithUsers().
			Only(suite.Ctx)
		suite.NoError(err)
		suite.Len(updated.Edges.Users, 0)
	})

	suite.Run("RemoveUser Already Removed", func() {
		// Add and then remove user
		err := suite.groupRepo.AddUser(suite.Ctx, suite.testGroup.ID, suite.testUser.ID)
		suite.NoError(err)
		err = suite.groupRepo.RemoveUser(suite.Ctx, suite.testGroup.ID, suite.testUser.ID)
		suite.NoError(err)

		// Try to remove again - should not error
		err = suite.groupRepo.RemoveUser(suite.Ctx, suite.testGroup.ID, suite.testUser.ID)
		suite.NoError(err)

		// Verify group is still empty
		updated, err := suite.DB.Group.Query().
			Where(group.IDEQ(suite.testGroup.ID)).
			WithUsers().
			Only(suite.Ctx)
		suite.NoError(err)
		suite.Len(updated.Edges.Users, 0)
	})

	suite.Run("RemoveUser Non-existent Group", func() {
		nonExistentGroupID := uuid.New()
		err := suite.groupRepo.RemoveUser(suite.Ctx, nonExistentGroupID, suite.testUser.ID)
		suite.Error(err)
	})

	suite.Run("RemoveUser Non-existent User", func() {
		nonExistentUserID := uuid.New()
		err := suite.groupRepo.RemoveUser(suite.Ctx, suite.testGroup.ID, nonExistentUserID)
		// This should not error - removing a non-existent user from a group is a no-op
		suite.NoError(err)
	})

	suite.Run("RemoveUser Error when DB closed", func() {
		suite.DB.Close()
		err := suite.groupRepo.RemoveUser(suite.Ctx, suite.testGroup.ID, suite.testUser.ID)
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func TestGroupMutationsSuite(t *testing.T) {
	suite.Run(t, new(GroupMutationsSuite))
}
