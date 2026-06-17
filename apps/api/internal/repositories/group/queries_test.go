package group_repo

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
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

type GroupQueriesSuite struct {
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
	testGroupK8s    *ent.Group
	testGroupEmpty  *ent.Group
	testPermission  *ent.Permission
}

func (suite *GroupQueriesSuite) SetupTest() {
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

	// Create test permission
	suite.testPermission = suite.DB.Permission.Create().
		SetAction(schema.ActionViewer).
		SetResourceType(schema.ResourceTypeProject).
		SetResourceSelector(schema.ResourceSelector{
			Superuser: false,
			ID:        uuid.New(),
		}).
		SaveX(suite.Ctx)

	// Create test groups
	suite.testGroup = suite.DB.Group.Create().
		SetName("Test Group").
		SetDescription("Test group description").
		AddUsers(suite.testUser).
		AddPermissions(suite.testPermission).
		SaveX(suite.Ctx)

	suite.testGroupK8s = suite.DB.Group.Create().
		SetName("K8s Test Group").
		SetDescription("K8s test group description").
		SetK8sRoleName("test-k8s-role").
		AddUsers(suite.testUser, suite.testUser2).
		SaveX(suite.Ctx)

	suite.testGroupEmpty = suite.DB.Group.Create().
		SetName("Empty Group").
		SetDescription("Empty group with no users or permissions").
		SaveX(suite.Ctx)
}

func (suite *GroupQueriesSuite) TearDownTest() {
	suite.RepositoryBaseSuite.TearDownTest()
	suite.groupRepo = nil
	suite.permissionsRepo = nil
	suite.userRepo = nil
	suite.projectRepo = nil
	suite.environmentRepo = nil
	suite.serviceRepo = nil
	suite.teamRepo = nil
	suite.deploymentRepo = nil
	suite.testUser = nil
	suite.testUser2 = nil
	suite.testGroup = nil
	suite.testGroupK8s = nil
	suite.testGroupEmpty = nil
	suite.testPermission = nil
}

func (suite *GroupQueriesSuite) TestGetByID() {
	suite.Run("GetByID Success", func() {
		group, err := suite.groupRepo.GetByID(suite.Ctx, suite.testGroup.ID)
		suite.NoError(err)
		suite.NotNil(group)
		suite.Equal(suite.testGroup.ID, group.ID)
		suite.Equal("Test Group", group.Name)
		suite.Equal("Test group description", group.Description)
		// Permissions edge should be loaded
		suite.NotNil(group.Edges.Permissions)
		suite.Len(group.Edges.Permissions, 1)
		suite.Equal(suite.testPermission.ID, group.Edges.Permissions[0].ID)
	})

	suite.Run("GetByID Group With K8s Role", func() {
		group, err := suite.groupRepo.GetByID(suite.Ctx, suite.testGroupK8s.ID)
		suite.NoError(err)
		suite.NotNil(group)
		suite.Equal(suite.testGroupK8s.ID, group.ID)
		suite.Equal("K8s Test Group", group.Name)
		suite.NotNil(group.K8sRoleName)
		suite.Equal("test-k8s-role", *group.K8sRoleName)
		// Permissions edge should be loaded (empty)
		suite.NotNil(group.Edges.Permissions)
		suite.Len(group.Edges.Permissions, 0)
	})

	suite.Run("GetByID Empty Group", func() {
		group, err := suite.groupRepo.GetByID(suite.Ctx, suite.testGroupEmpty.ID)
		suite.NoError(err)
		suite.NotNil(group)
		suite.Equal(suite.testGroupEmpty.ID, group.ID)
		suite.Equal("Empty Group", group.Name)
		suite.Nil(group.K8sRoleName)
		// Permissions edge should be loaded (empty)
		suite.NotNil(group.Edges.Permissions)
		suite.Len(group.Edges.Permissions, 0)
	})

	suite.Run("GetByID Not Found", func() {
		nonExistentID := uuid.New()
		group, err := suite.groupRepo.GetByID(suite.Ctx, nonExistentID)
		suite.Error(err)
		suite.Nil(group)
	})

	suite.Run("GetByID Error when DB closed", func() {
		suite.DB.Close()
		group, err := suite.groupRepo.GetByID(suite.Ctx, suite.testGroup.ID)
		suite.Error(err)
		suite.Nil(group)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *GroupQueriesSuite) TestGetAllWithK8sRole() {
	suite.Run("GetAllWithK8sRole Success", func() {
		groups, err := suite.groupRepo.GetAllWithK8sRole(suite.Ctx)
		suite.NoError(err)
		suite.Len(groups, 1)
		suite.Equal(suite.testGroupK8s.ID, groups[0].ID)
		suite.Equal("K8s Test Group", groups[0].Name)
		suite.NotNil(groups[0].K8sRoleName)
		suite.Equal("test-k8s-role", *groups[0].K8sRoleName)
	})

	suite.Run("GetAllWithK8sRole Multiple Groups", func() {
		// Create another group with K8s role
		anotherK8sGroup := suite.DB.Group.Create().
			SetName("Another K8s Group").
			SetDescription("Another K8s group").
			SetK8sRoleName("another-k8s-role").
			SaveX(suite.Ctx)

		groups, err := suite.groupRepo.GetAllWithK8sRole(suite.Ctx)
		suite.NoError(err)
		suite.Len(groups, 2)

		// Verify both groups are returned
		groupIDs := make([]uuid.UUID, len(groups))
		for i, group := range groups {
			groupIDs[i] = group.ID
			suite.NotNil(group.K8sRoleName) // All should have K8s role names
		}
		suite.Contains(groupIDs, suite.testGroupK8s.ID)
		suite.Contains(groupIDs, anotherK8sGroup.ID)
	})

	suite.Run("GetAllWithK8sRole No K8s Groups", func() {
		// Clear the K8s role from the existing group
		suite.DB.Group.Update().
			ClearK8sRoleName().
			SaveX(suite.Ctx)

		groups, err := suite.groupRepo.GetAllWithK8sRole(suite.Ctx)
		suite.NoError(err)
		suite.Len(groups, 0)
	})

	suite.Run("GetAllWithK8sRole Error when DB closed", func() {
		suite.DB.Close()
		groups, err := suite.groupRepo.GetAllWithK8sRole(suite.Ctx)
		suite.Error(err)
		suite.Nil(groups)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *GroupQueriesSuite) TestGetAllWithPermissions() {
	suite.Run("GetAllWithPermissions Success", func() {
		groups, err := suite.groupRepo.GetAllWithPermissions(suite.Ctx)
		suite.NoError(err)
		suite.Len(groups, 3) // All three test groups

		// Find the group with permissions
		var groupWithPermissions *ent.Group
		for _, group := range groups {
			if group.ID == suite.testGroup.ID {
				groupWithPermissions = group
				break
			}
		}
		suite.NotNil(groupWithPermissions)
		suite.NotNil(groupWithPermissions.Edges.Permissions)
		suite.Len(groupWithPermissions.Edges.Permissions, 1)
		suite.Equal(suite.testPermission.ID, groupWithPermissions.Edges.Permissions[0].ID)

		// Verify other groups have empty permissions
		for _, group := range groups {
			suite.NotNil(group.Edges.Permissions) // Edge should be loaded
			if group.ID != suite.testGroup.ID {
				suite.Len(group.Edges.Permissions, 0)
			}
		}
	})

	suite.Run("GetAllWithPermissions Multiple Permissions", func() {
		// Create another permission and add to group
		anotherPermission := suite.DB.Permission.Create().
			SetAction(schema.ActionAdmin).
			SetResourceType(schema.ResourceTypeTeam).
			SetResourceSelector(schema.ResourceSelector{
				Superuser: true,
				ID:        uuid.New(),
			}).
			SaveX(suite.Ctx)

		suite.DB.Group.UpdateOne(suite.testGroup).
			AddPermissions(anotherPermission).
			SaveX(suite.Ctx)

		groups, err := suite.groupRepo.GetAllWithPermissions(suite.Ctx)
		suite.NoError(err)

		// Find the group with permissions
		var groupWithPermissions *ent.Group
		for _, group := range groups {
			if group.ID == suite.testGroup.ID {
				groupWithPermissions = group
				break
			}
		}
		suite.NotNil(groupWithPermissions)
		suite.Len(groupWithPermissions.Edges.Permissions, 2)

		permissionIDs := make([]uuid.UUID, len(groupWithPermissions.Edges.Permissions))
		for i, perm := range groupWithPermissions.Edges.Permissions {
			permissionIDs[i] = perm.ID
		}
		suite.Contains(permissionIDs, suite.testPermission.ID)
		suite.Contains(permissionIDs, anotherPermission.ID)
	})

	suite.Run("GetAllWithPermissions No Groups", func() {
		// Delete all groups
		suite.DB.Group.Delete().ExecX(suite.Ctx)

		groups, err := suite.groupRepo.GetAllWithPermissions(suite.Ctx)
		suite.NoError(err)
		suite.Len(groups, 0)
	})

	suite.Run("GetAllWithPermissions Error when DB closed", func() {
		suite.DB.Close()
		groups, err := suite.groupRepo.GetAllWithPermissions(suite.Ctx)
		suite.Error(err)
		suite.Nil(groups)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *GroupQueriesSuite) TestHasUserWithID() {
	suite.Run("HasUserWithID True", func() {
		has, err := suite.groupRepo.HasUserWithID(suite.Ctx, suite.testGroup.ID, suite.testUser.ID)
		suite.NoError(err)
		suite.True(has)
	})

	suite.Run("HasUserWithID False - User Not in Group", func() {
		has, err := suite.groupRepo.HasUserWithID(suite.Ctx, suite.testGroup.ID, suite.testUser2.ID)
		suite.NoError(err)
		suite.False(has)
	})

	suite.Run("HasUserWithID False - Non-existent Group", func() {
		nonExistentGroupID := uuid.New()
		has, err := suite.groupRepo.HasUserWithID(suite.Ctx, nonExistentGroupID, suite.testUser.ID)
		suite.NoError(err)
		suite.False(has)
	})

	suite.Run("HasUserWithID False - Non-existent User", func() {
		nonExistentUserID := uuid.New()
		has, err := suite.groupRepo.HasUserWithID(suite.Ctx, suite.testGroup.ID, nonExistentUserID)
		suite.NoError(err)
		suite.False(has)
	})

	suite.Run("HasUserWithID Multiple Groups", func() {
		// testUser is in testGroup, testUser2 is in testGroupK8s
		has1, err := suite.groupRepo.HasUserWithID(suite.Ctx, suite.testGroup.ID, suite.testUser.ID)
		suite.NoError(err)
		suite.True(has1)

		has2, err := suite.groupRepo.HasUserWithID(suite.Ctx, suite.testGroupK8s.ID, suite.testUser2.ID)
		suite.NoError(err)
		suite.True(has2)

		// testUser is also in testGroupK8s based on setup
		has3, err := suite.groupRepo.HasUserWithID(suite.Ctx, suite.testGroupK8s.ID, suite.testUser.ID)
		suite.NoError(err)
		suite.True(has3)
	})

	suite.Run("HasUserWithID Error when DB closed", func() {
		suite.DB.Close()
		has, err := suite.groupRepo.HasUserWithID(suite.Ctx, suite.testGroup.ID, suite.testUser.ID)
		suite.Error(err)
		suite.False(has)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *GroupQueriesSuite) TestGetMembers() {
	suite.Run("GetMembers Success", func() {
		members, err := suite.groupRepo.GetMembers(suite.Ctx, suite.testGroup.ID)
		suite.NoError(err)
		suite.Len(members, 1)
		suite.Equal(suite.testUser.ID, members[0].ID)
		suite.Equal("test@example.com", members[0].Email)
	})

	suite.Run("GetMembers Multiple Members", func() {
		members, err := suite.groupRepo.GetMembers(suite.Ctx, suite.testGroupK8s.ID)
		suite.NoError(err)
		suite.Len(members, 2)

		memberIDs := make([]uuid.UUID, len(members))
		for i, member := range members {
			memberIDs[i] = member.ID
		}
		suite.Contains(memberIDs, suite.testUser.ID)
		suite.Contains(memberIDs, suite.testUser2.ID)
	})

	suite.Run("GetMembers Empty Group", func() {
		members, err := suite.groupRepo.GetMembers(suite.Ctx, suite.testGroupEmpty.ID)
		suite.NoError(err)
		suite.Len(members, 0)
	})

	suite.Run("GetMembers Non-existent Group", func() {
		nonExistentGroupID := uuid.New()
		members, err := suite.groupRepo.GetMembers(suite.Ctx, nonExistentGroupID)
		suite.NoError(err)
		suite.Len(members, 0)
	})

	suite.Run("GetMembers Error when DB closed", func() {
		suite.DB.Close()
		members, err := suite.groupRepo.GetMembers(suite.Ctx, suite.testGroup.ID)
		suite.Error(err)
		suite.Nil(members)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *GroupQueriesSuite) TestGetPermissions() {
	suite.Run("GetPermissions Success", func() {
		permissions, err := suite.groupRepo.GetPermissions(suite.Ctx, suite.testGroup.ID)
		suite.NoError(err)
		suite.Len(permissions, 1)
		suite.Equal(suite.testPermission.ID, permissions[0].ID)
		suite.Equal(schema.ActionViewer, permissions[0].Action)
		suite.Equal(schema.ResourceTypeProject, permissions[0].ResourceType)
		suite.Equal(suite.testPermission.ResourceSelector, permissions[0].ResourceSelector)
	})

	suite.Run("GetPermissions Multiple Permissions", func() {
		// Create and add another permission
		anotherPermission := suite.DB.Permission.Create().
			SetAction(schema.ActionAdmin).
			SetResourceType(schema.ResourceTypeService).
			SetResourceSelector(schema.ResourceSelector{
				Superuser: true,
				ID:        uuid.New(),
			}).
			SaveX(suite.Ctx)

		suite.DB.Group.UpdateOne(suite.testGroup).
			AddPermissions(anotherPermission).
			SaveX(suite.Ctx)

		permissions, err := suite.groupRepo.GetPermissions(suite.Ctx, suite.testGroup.ID)
		suite.NoError(err)
		suite.Len(permissions, 2)

		permissionIDs := make([]uuid.UUID, len(permissions))
		for i, perm := range permissions {
			permissionIDs[i] = perm.ID
		}
		suite.Contains(permissionIDs, suite.testPermission.ID)
		suite.Contains(permissionIDs, anotherPermission.ID)
	})

	suite.Run("GetPermissions No Permissions", func() {
		permissions, err := suite.groupRepo.GetPermissions(suite.Ctx, suite.testGroupK8s.ID)
		suite.NoError(err)
		suite.Len(permissions, 0)
	})

	suite.Run("GetPermissions Non-existent Group", func() {
		nonExistentGroupID := uuid.New()
		permissions, err := suite.groupRepo.GetPermissions(suite.Ctx, nonExistentGroupID)
		suite.NoError(err)
		suite.Len(permissions, 0)
	})

	suite.Run("GetPermissions Error when DB closed", func() {
		suite.DB.Close()
		permissions, err := suite.groupRepo.GetPermissions(suite.Ctx, suite.testGroup.ID)
		suite.Error(err)
		suite.Nil(permissions)
		suite.ErrorContains(err, "database is closed")
	})
}

func TestGroupQueriesSuite(t *testing.T) {
	suite.Run(t, new(GroupQueriesSuite))
}
