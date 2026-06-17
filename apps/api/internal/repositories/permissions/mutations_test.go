package permissions_repo

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/group"
	"github.com/unbindapp/unbind-api/ent/schema"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	deployment_repo "github.com/unbindapp/unbind-api/internal/repositories/deployment"
	environment_repo "github.com/unbindapp/unbind-api/internal/repositories/environment"
	project_repo "github.com/unbindapp/unbind-api/internal/repositories/project"
	service_repo "github.com/unbindapp/unbind-api/internal/repositories/service"
	team_repo "github.com/unbindapp/unbind-api/internal/repositories/team"
	user_repo "github.com/unbindapp/unbind-api/internal/repositories/user"
	"golang.org/x/crypto/bcrypt"
)

type PermissionsMutationsSuite struct {
	repository.RepositoryBaseSuite
	permissionsRepo *PermissionsRepository
	userRepo        *user_repo.UserRepository
	projectRepo     *project_repo.ProjectRepository
	environmentRepo *environment_repo.EnvironmentRepository
	serviceRepo     *service_repo.ServiceRepository
	teamRepo        *team_repo.TeamRepository
	deploymentRepo  *deployment_repo.DeploymentRepository
	testUser        *ent.User
	testGroup       *ent.Group
	testPermission  *ent.Permission
}

func (suite *PermissionsMutationsSuite) SetupTest() {
	suite.RepositoryBaseSuite.SetupTest()
	suite.userRepo = user_repo.NewUserRepository(suite.DB)
	suite.projectRepo = project_repo.NewProjectRepository(suite.DB)
	suite.environmentRepo = environment_repo.NewEnvironmentRepository(suite.DB)
	suite.deploymentRepo = deployment_repo.NewDeploymentRepository(suite.DB)
	suite.serviceRepo = service_repo.NewServiceRepository(suite.DB, suite.deploymentRepo)
	suite.teamRepo = team_repo.NewTeamRepository(suite.DB)
	suite.permissionsRepo = NewPermissionsRepository(suite.DB, suite.userRepo, suite.projectRepo, suite.environmentRepo, suite.serviceRepo, suite.teamRepo)

	// Create test user
	pwd, _ := bcrypt.GenerateFromPassword([]byte("test-password"), 1)
	suite.testUser = suite.DB.User.Create().
		SetEmail("test@example.com").
		SetPasswordHash(string(pwd)).
		SaveX(suite.Ctx)

	// Create test group
	suite.testGroup = suite.DB.Group.Create().
		SetName("Test Group").
		SetDescription("Test group description").
		SaveX(suite.Ctx)

	// Create test permission
	resourceID := uuid.New()
	suite.testPermission = suite.DB.Permission.Create().
		SetAction(schema.ActionViewer).
		SetResourceType(schema.ResourceTypeProject).
		SetResourceSelector(schema.ResourceSelector{
			Superuser: false,
			ID:        resourceID,
		}).
		SaveX(suite.Ctx)
}

func (suite *PermissionsMutationsSuite) TearDownTest() {
	suite.RepositoryBaseSuite.TearDownTest()
	suite.permissionsRepo = nil
	suite.userRepo = nil
	suite.projectRepo = nil
	suite.environmentRepo = nil
	suite.serviceRepo = nil
	suite.teamRepo = nil
	suite.deploymentRepo = nil
	suite.testUser = nil
	suite.testGroup = nil
	suite.testPermission = nil
}

func (suite *PermissionsMutationsSuite) TestCreate() {
	suite.Run("Create Success", func() {
		resourceID := uuid.New()
		selector := schema.ResourceSelector{
			Superuser: false,
			ID:        resourceID,
		}

		permission, err := suite.permissionsRepo.Create(
			suite.Ctx,
			schema.ActionAdmin,
			schema.ResourceTypeTeam,
			selector,
		)
		suite.NoError(err)
		suite.NotNil(permission)
		suite.Equal(schema.ActionAdmin, permission.Action)
		suite.Equal(schema.ResourceTypeTeam, permission.ResourceType)
		suite.Equal(selector, permission.ResourceSelector)
		suite.NotEqual(uuid.Nil, permission.ID)
	})

	suite.Run("Create Superuser Permission", func() {
		selector := schema.ResourceSelector{
			Superuser: true,
			ID:        uuid.New(), // ID should be ignored when Superuser is true
		}

		permission, err := suite.permissionsRepo.Create(
			suite.Ctx,
			schema.ActionAdmin,
			schema.ResourceTypeSystem,
			selector,
		)
		suite.NoError(err)
		suite.NotNil(permission)
		suite.Equal(schema.ActionAdmin, permission.Action)
		suite.Equal(schema.ResourceTypeSystem, permission.ResourceType)
		suite.True(permission.ResourceSelector.Superuser)
	})

	suite.Run("Create Editor Permission", func() {
		resourceID := uuid.New()
		selector := schema.ResourceSelector{
			Superuser: false,
			ID:        resourceID,
		}

		permission, err := suite.permissionsRepo.Create(
			suite.Ctx,
			schema.ActionEditor,
			schema.ResourceTypeService,
			selector,
		)
		suite.NoError(err)
		suite.NotNil(permission)
		suite.Equal(schema.ActionEditor, permission.Action)
		suite.Equal(schema.ResourceTypeService, permission.ResourceType)
		suite.False(permission.ResourceSelector.Superuser)
		suite.Equal(resourceID, permission.ResourceSelector.ID)
	})

	suite.Run("Create Environment Permission", func() {
		resourceID := uuid.New()
		selector := schema.ResourceSelector{
			Superuser: false,
			ID:        resourceID,
		}

		permission, err := suite.permissionsRepo.Create(
			suite.Ctx,
			schema.ActionViewer,
			schema.ResourceTypeEnvironment,
			selector,
		)
		suite.NoError(err)
		suite.NotNil(permission)
		suite.Equal(schema.ActionViewer, permission.Action)
		suite.Equal(schema.ResourceTypeEnvironment, permission.ResourceType)
		suite.Equal(selector, permission.ResourceSelector)
	})

	suite.Run("Create Error when DB closed", func() {
		suite.DB.Close()
		selector := schema.ResourceSelector{
			Superuser: false,
			ID:        uuid.New(),
		}

		permission, err := suite.permissionsRepo.Create(
			suite.Ctx,
			schema.ActionViewer,
			schema.ResourceTypeProject,
			selector,
		)
		suite.Error(err)
		suite.Nil(permission)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *PermissionsMutationsSuite) TestAddToGroup() {
	suite.Run("AddToGroup Success", func() {
		// Clean group state before this subtest
		suite.DB.Group.UpdateOneID(suite.testGroup.ID).ClearPermissions().ExecX(suite.Ctx)

		err := suite.permissionsRepo.AddToGroup(suite.Ctx, suite.testGroup.ID, suite.testPermission.ID)
		suite.NoError(err)

		// Verify the permission was added to the group
		updated, err := suite.DB.Group.Query().
			Where(group.IDEQ(suite.testGroup.ID)).
			WithPermissions().
			Only(suite.Ctx)
		suite.NoError(err)
		suite.Len(updated.Edges.Permissions, 1)
		suite.Equal(suite.testPermission.ID, updated.Edges.Permissions[0].ID)
	})

	suite.Run("AddToGroup Multiple Permissions", func() {
		// Clean group state before this subtest
		suite.DB.Group.UpdateOneID(suite.testGroup.ID).ClearPermissions().ExecX(suite.Ctx)

		// Create another permission
		anotherPermission := suite.DB.Permission.Create().
			SetAction(schema.ActionAdmin).
			SetResourceType(schema.ResourceTypeTeam).
			SetResourceSelector(schema.ResourceSelector{
				Superuser: true,
				ID:        uuid.New(),
			}).
			SaveX(suite.Ctx)

		// Add first permission
		err := suite.permissionsRepo.AddToGroup(suite.Ctx, suite.testGroup.ID, suite.testPermission.ID)
		suite.NoError(err)

		// Add second permission
		err = suite.permissionsRepo.AddToGroup(suite.Ctx, suite.testGroup.ID, anotherPermission.ID)
		suite.NoError(err)

		// Verify both permissions are in the group
		updated, err := suite.DB.Group.Query().
			Where(group.IDEQ(suite.testGroup.ID)).
			WithPermissions().
			Only(suite.Ctx)
		suite.NoError(err)
		suite.Len(updated.Edges.Permissions, 2)

		permissionIDs := make([]uuid.UUID, len(updated.Edges.Permissions))
		for i, perm := range updated.Edges.Permissions {
			permissionIDs[i] = perm.ID
		}
		suite.Contains(permissionIDs, suite.testPermission.ID)
		suite.Contains(permissionIDs, anotherPermission.ID)
	})

	suite.Run("AddToGroup Already Added", func() {
		// Clean group state before this subtest
		suite.DB.Group.UpdateOneID(suite.testGroup.ID).ClearPermissions().ExecX(suite.Ctx)

		// Add permission first time
		err := suite.permissionsRepo.AddToGroup(suite.Ctx, suite.testGroup.ID, suite.testPermission.ID)
		suite.NoError(err)

		// Add same permission again - should not error but also not duplicate
		err = suite.permissionsRepo.AddToGroup(suite.Ctx, suite.testGroup.ID, suite.testPermission.ID)
		suite.NoError(err)

		// Verify only one instance of the permission
		updated, err := suite.DB.Group.Query().
			Where(group.IDEQ(suite.testGroup.ID)).
			WithPermissions().
			Only(suite.Ctx)
		suite.NoError(err)
		suite.Len(updated.Edges.Permissions, 1)
		suite.Equal(suite.testPermission.ID, updated.Edges.Permissions[0].ID)
	})

	suite.Run("AddToGroup Non-existent Group", func() {
		nonExistentGroupID := uuid.New()
		err := suite.permissionsRepo.AddToGroup(suite.Ctx, nonExistentGroupID, suite.testPermission.ID)
		suite.Error(err)
	})

	suite.Run("AddToGroup Non-existent Permission", func() {
		nonExistentPermissionID := uuid.New()
		err := suite.permissionsRepo.AddToGroup(suite.Ctx, suite.testGroup.ID, nonExistentPermissionID)
		suite.Error(err)
	})

	suite.Run("AddToGroup Error when DB closed", func() {
		suite.DB.Close()
		err := suite.permissionsRepo.AddToGroup(suite.Ctx, suite.testGroup.ID, suite.testPermission.ID)
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *PermissionsMutationsSuite) TestDelete() {
	suite.Run("Delete Success", func() {
		// Create a permission to delete
		resourceID := uuid.New()
		permission := suite.DB.Permission.Create().
			SetAction(schema.ActionEditor).
			SetResourceType(schema.ResourceTypeProject).
			SetResourceSelector(schema.ResourceSelector{
				Superuser: false,
				ID:        resourceID,
			}).
			SaveX(suite.Ctx)

		// Verify it exists
		found, err := suite.DB.Permission.Get(suite.Ctx, permission.ID)
		suite.NoError(err)
		suite.NotNil(found)

		// Delete it
		err = suite.permissionsRepo.Delete(suite.Ctx, permission.ID)
		suite.NoError(err)

		// Verify it's gone
		_, err = suite.DB.Permission.Get(suite.Ctx, permission.ID)
		suite.Error(err)
	})

	suite.Run("Delete Permission in Group", func() {
		// Add permission to group
		err := suite.permissionsRepo.AddToGroup(suite.Ctx, suite.testGroup.ID, suite.testPermission.ID)
		suite.NoError(err)

		// Verify it's in the group
		updated, err := suite.DB.Group.Query().
			Where(group.IDEQ(suite.testGroup.ID)).
			WithPermissions().
			Only(suite.Ctx)
		suite.NoError(err)
		suite.Len(updated.Edges.Permissions, 1)

		// Delete the permission
		err = suite.permissionsRepo.Delete(suite.Ctx, suite.testPermission.ID)
		suite.NoError(err)

		// Verify permission is deleted and removed from group
		_, err = suite.DB.Permission.Get(suite.Ctx, suite.testPermission.ID)
		suite.Error(err)

		updated, err = suite.DB.Group.Query().
			Where(group.IDEQ(suite.testGroup.ID)).
			WithPermissions().
			Only(suite.Ctx)
		suite.NoError(err)
		suite.Len(updated.Edges.Permissions, 0)
	})

	suite.Run("Delete Non-existent Permission", func() {
		// Clean group state before this subtest
		suite.DB.Group.UpdateOneID(suite.testGroup.ID).ClearPermissions().ExecX(suite.Ctx)

		nonExistentID := uuid.New()
		err := suite.permissionsRepo.Delete(suite.Ctx, nonExistentID)
		// Should return ent not found
		suite.Error(err)
		suite.True(ent.IsNotFound(err))
	})

	suite.Run("Delete Error when DB closed", func() {
		suite.DB.Close()
		err := suite.permissionsRepo.Delete(suite.Ctx, suite.testPermission.ID)
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *PermissionsMutationsSuite) TestRemoveFromGroup() {
	suite.Run("RemoveFromGroup Success", func() {
		// First add the permission to the group
		err := suite.permissionsRepo.AddToGroup(suite.Ctx, suite.testGroup.ID, suite.testPermission.ID)
		suite.NoError(err)

		// Verify it was added
		updated, err := suite.DB.Group.Query().
			Where(group.IDEQ(suite.testGroup.ID)).
			WithPermissions().
			Only(suite.Ctx)
		suite.NoError(err)
		suite.Len(updated.Edges.Permissions, 1)

		// Now remove it
		err = suite.permissionsRepo.RemoveFromGroup(suite.Ctx, suite.testGroup.ID, suite.testPermission.ID)
		suite.NoError(err)

		// Verify it was removed
		updated, err = suite.DB.Group.Query().
			Where(group.IDEQ(suite.testGroup.ID)).
			WithPermissions().
			Only(suite.Ctx)
		suite.NoError(err)
		suite.Len(updated.Edges.Permissions, 0)

		// Verify permission still exists
		_, err = suite.DB.Permission.Get(suite.Ctx, suite.testPermission.ID)
		suite.NoError(err)
	})

	suite.Run("RemoveFromGroup One of Multiple Permissions", func() {
		// Create another permission
		anotherPermission := suite.DB.Permission.Create().
			SetAction(schema.ActionAdmin).
			SetResourceType(schema.ResourceTypeService).
			SetResourceSelector(schema.ResourceSelector{
				Superuser: true,
				ID:        uuid.New(),
			}).
			SaveX(suite.Ctx)

		// Add both permissions
		err := suite.permissionsRepo.AddToGroup(suite.Ctx, suite.testGroup.ID, suite.testPermission.ID)
		suite.NoError(err)
		err = suite.permissionsRepo.AddToGroup(suite.Ctx, suite.testGroup.ID, anotherPermission.ID)
		suite.NoError(err)

		// Verify both were added
		updated, err := suite.DB.Group.Query().
			Where(group.IDEQ(suite.testGroup.ID)).
			WithPermissions().
			Only(suite.Ctx)
		suite.NoError(err)
		suite.Len(updated.Edges.Permissions, 2)

		// Remove first permission
		err = suite.permissionsRepo.RemoveFromGroup(suite.Ctx, suite.testGroup.ID, suite.testPermission.ID)
		suite.NoError(err)

		// Verify only second permission remains
		updated, err = suite.DB.Group.Query().
			Where(group.IDEQ(suite.testGroup.ID)).
			WithPermissions().
			Only(suite.Ctx)
		suite.NoError(err)
		suite.Len(updated.Edges.Permissions, 1)
		suite.Equal(anotherPermission.ID, updated.Edges.Permissions[0].ID)
	})

	suite.Run("RemoveFromGroup Not in Group", func() {
		// Clear group state before this subtest
		suite.DB.Group.UpdateOneID(suite.testGroup.ID).ClearPermissions().ExecX(suite.Ctx)

		// Try to remove a permission that's not in the group - should not error
		err := suite.permissionsRepo.RemoveFromGroup(suite.Ctx, suite.testGroup.ID, suite.testPermission.ID)
		suite.NoError(err)

		// Verify group is still empty
		updated, err := suite.DB.Group.Query().
			Where(group.IDEQ(suite.testGroup.ID)).
			WithPermissions().
			Only(suite.Ctx)
		suite.NoError(err)
		suite.Len(updated.Edges.Permissions, 0)
	})

	suite.Run("RemoveFromGroup Already Removed", func() {
		// Add and then remove permission
		err := suite.permissionsRepo.AddToGroup(suite.Ctx, suite.testGroup.ID, suite.testPermission.ID)
		suite.NoError(err)
		err = suite.permissionsRepo.RemoveFromGroup(suite.Ctx, suite.testGroup.ID, suite.testPermission.ID)
		suite.NoError(err)

		// Try to remove again - should not error
		err = suite.permissionsRepo.RemoveFromGroup(suite.Ctx, suite.testGroup.ID, suite.testPermission.ID)
		suite.NoError(err)

		// Verify group is still empty
		updated, err := suite.DB.Group.Query().
			Where(group.IDEQ(suite.testGroup.ID)).
			WithPermissions().
			Only(suite.Ctx)
		suite.NoError(err)
		suite.Len(updated.Edges.Permissions, 0)
	})

	suite.Run("RemoveFromGroup Non-existent Group", func() {
		nonExistentGroupID := uuid.New()
		err := suite.permissionsRepo.RemoveFromGroup(suite.Ctx, nonExistentGroupID, suite.testPermission.ID)
		suite.Error(err)
	})

	suite.Run("RemoveFromGroup Non-existent Permission", func() {
		nonExistentPermissionID := uuid.New()
		err := suite.permissionsRepo.RemoveFromGroup(suite.Ctx, suite.testGroup.ID, nonExistentPermissionID)
		// This should not error - removing a non-existent permission from a group is a no-op
		suite.NoError(err)
	})

	suite.Run("RemoveFromGroup Error when DB closed", func() {
		suite.DB.Close()
		err := suite.permissionsRepo.RemoveFromGroup(suite.Ctx, suite.testGroup.ID, suite.testPermission.ID)
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func TestPermissionsMutationsSuite(t *testing.T) {
	suite.Run(t, new(PermissionsMutationsSuite))
}
