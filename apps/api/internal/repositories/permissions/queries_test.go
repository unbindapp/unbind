package permissions_repo

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
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

type PermissionsQueriesSuite struct {
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
	testGroup2      *ent.Group
	testPermission  *ent.Permission
}

func (suite *PermissionsQueriesSuite) SetupTest() {
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

	// Create test groups
	suite.testGroup = suite.DB.Group.Create().
		SetName("Test Group").
		SetDescription("Test group description").
		SaveX(suite.Ctx)

	suite.testGroup2 = suite.DB.Group.Create().
		SetName("Test Group 2").
		SetDescription("Second test group description").
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
		AddGroups(suite.testGroup, suite.testGroup2).
		SaveX(suite.Ctx)
}

func (suite *PermissionsQueriesSuite) TearDownTest() {
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
	suite.testGroup2 = nil
	suite.testPermission = nil
}

func (suite *PermissionsQueriesSuite) TestGetByID() {
	suite.Run("GetByID Success", func() {
		permission, err := suite.permissionsRepo.GetByID(suite.Ctx, suite.testPermission.ID)
		suite.NoError(err)
		suite.NotNil(permission)
		suite.Equal(suite.testPermission.ID, permission.ID)
		suite.Equal(schema.ActionViewer, permission.Action)
		suite.Equal(schema.ResourceTypeProject, permission.ResourceType)
		suite.False(permission.ResourceSelector.Superuser)
		// Groups edge should be loaded
		suite.NotNil(permission.Edges.Groups)
		suite.Len(permission.Edges.Groups, 2)

		groupIDs := make([]uuid.UUID, len(permission.Edges.Groups))
		for i, group := range permission.Edges.Groups {
			groupIDs[i] = group.ID
		}
		suite.Contains(groupIDs, suite.testGroup.ID)
		suite.Contains(groupIDs, suite.testGroup2.ID)
	})

	suite.Run("GetByID Permission With No Groups", func() {
		// Create a permission not associated with any groups
		standalonePermission := suite.DB.Permission.Create().
			SetAction(schema.ActionAdmin).
			SetResourceType(schema.ResourceTypeTeam).
			SetResourceSelector(schema.ResourceSelector{
				Superuser: true,
				ID:        uuid.New(),
			}).
			SaveX(suite.Ctx)

		permission, err := suite.permissionsRepo.GetByID(suite.Ctx, standalonePermission.ID)
		suite.NoError(err)
		suite.NotNil(permission)
		suite.Equal(standalonePermission.ID, permission.ID)
		suite.Equal(schema.ActionAdmin, permission.Action)
		suite.Equal(schema.ResourceTypeTeam, permission.ResourceType)
		suite.True(permission.ResourceSelector.Superuser)
		// Groups edge should be loaded but empty
		suite.NotNil(permission.Edges.Groups)
		suite.Len(permission.Edges.Groups, 0)
	})

	suite.Run("GetByID Superuser Permission", func() {
		superuserPermission := suite.DB.Permission.Create().
			SetAction(schema.ActionAdmin).
			SetResourceType(schema.ResourceTypeSystem).
			SetResourceSelector(schema.ResourceSelector{
				Superuser: true,
				ID:        uuid.New(), // Should be ignored when superuser is true
			}).
			AddGroups(suite.testGroup).
			SaveX(suite.Ctx)

		permission, err := suite.permissionsRepo.GetByID(suite.Ctx, superuserPermission.ID)
		suite.NoError(err)
		suite.NotNil(permission)
		suite.Equal(superuserPermission.ID, permission.ID)
		suite.Equal(schema.ActionAdmin, permission.Action)
		suite.Equal(schema.ResourceTypeSystem, permission.ResourceType)
		suite.True(permission.ResourceSelector.Superuser)
		// Groups edge should be loaded
		suite.NotNil(permission.Edges.Groups)
		suite.Len(permission.Edges.Groups, 1)
		suite.Equal(suite.testGroup.ID, permission.Edges.Groups[0].ID)
	})

	suite.Run("GetByID Not Found", func() {
		nonExistentID := uuid.New()
		permission, err := suite.permissionsRepo.GetByID(suite.Ctx, nonExistentID)
		suite.Error(err)
		suite.Nil(permission)
	})

	suite.Run("GetByID Error when DB closed", func() {
		suite.DB.Close()
		permission, err := suite.permissionsRepo.GetByID(suite.Ctx, suite.testPermission.ID)
		suite.Error(err)
		suite.Nil(permission)
		suite.ErrorContains(err, "database is closed")
	})
}

func TestPermissionsQueriesSuite(t *testing.T) {
	suite.Run(t, new(PermissionsQueriesSuite))
}
