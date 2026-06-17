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

type PermissionsPredicatesSuite struct {
	repository.RepositoryBaseSuite
	permissionsRepo *PermissionsRepository
	userRepo        *user_repo.UserRepository
	projectRepo     *project_repo.ProjectRepository
	environmentRepo *environment_repo.EnvironmentRepository
	serviceRepo     *service_repo.ServiceRepository
	teamRepo        *team_repo.TeamRepository
	deploymentRepo  *deployment_repo.DeploymentRepository

	// Test entities
	testUser     *ent.User
	testUser2    *ent.User
	testTeam     *ent.Team
	testTeam2    *ent.Team
	testProject  *ent.Project
	testProject2 *ent.Project
	testEnv      *ent.Environment
	testEnv2     *ent.Environment
	testService  *ent.Service
	testService2 *ent.Service

	// Test groups with various permissions
	noPermissionsUser    *ent.User
	teamViewerUser       *ent.User
	teamAdminUser        *ent.User
	projectEditorUser    *ent.User
	envViewerUser        *ent.User
	serviceEditorUser    *ent.User
	superuserUser        *ent.User
	teamSuperuserUser    *ent.User
	projectSuperuserUser *ent.User
	envSuperuserUser     *ent.User
	serviceSuperuserUser *ent.User
}

func (suite *PermissionsPredicatesSuite) SetupTest() {
	suite.RepositoryBaseSuite.SetupTest()

	// Initialize repositories
	suite.userRepo = user_repo.NewUserRepository(suite.DB)
	suite.projectRepo = project_repo.NewProjectRepository(suite.DB)
	suite.environmentRepo = environment_repo.NewEnvironmentRepository(suite.DB)
	suite.deploymentRepo = deployment_repo.NewDeploymentRepository(suite.DB)
	suite.serviceRepo = service_repo.NewServiceRepository(suite.DB, suite.deploymentRepo)
	suite.teamRepo = team_repo.NewTeamRepository(suite.DB)
	suite.permissionsRepo = NewPermissionsRepository(
		suite.DB,
		suite.userRepo,
		suite.projectRepo,
		suite.environmentRepo,
		suite.serviceRepo,
		suite.teamRepo,
	)

	suite.createTestEntities()
	suite.createTestUsers()
}

func (suite *PermissionsPredicatesSuite) createTestEntities() {
	// Create test teams
	suite.testTeam = suite.DB.Team.Create().
		SetName("Test Team").
		SetKubernetesName("test-team").
		SetNamespace("test-namespace").
		SetKubernetesSecret("test-team-secret").
		SaveX(suite.Ctx)

	suite.testTeam2 = suite.DB.Team.Create().
		SetName("Test Team 2").
		SetKubernetesName("test-team-2").
		SetNamespace("test-namespace-2").
		SetKubernetesSecret("test-team-2-secret").
		SaveX(suite.Ctx)

	// Create test projects
	suite.testProject = suite.DB.Project.Create().
		SetName("Test Project").
		SetKubernetesName("test-project-k8s").
		SetKubernetesSecret("test-secret").
		SetTeamID(suite.testTeam.ID).
		SaveX(suite.Ctx)

	suite.testProject2 = suite.DB.Project.Create().
		SetName("Test Project 2").
		SetKubernetesName("test-project-2-k8s").
		SetKubernetesSecret("test-secret-2").
		SetTeamID(suite.testTeam2.ID).
		SaveX(suite.Ctx)

	// Create test environments
	suite.testEnv = suite.DB.Environment.Create().
		SetName("Test Environment").
		SetKubernetesName("test-env-k8s").
		SetKubernetesSecret("test-env-secret").
		SetProjectID(suite.testProject.ID).
		SaveX(suite.Ctx)

	suite.testEnv2 = suite.DB.Environment.Create().
		SetName("Test Environment 2").
		SetKubernetesName("test-env-2-k8s").
		SetKubernetesSecret("test-env-secret-2").
		SetProjectID(suite.testProject2.ID).
		SaveX(suite.Ctx)

	// Create test services
	suite.testService = suite.DB.Service.Create().
		SetName("Test Service").
		SetKubernetesName("test-service").
		SetType(schema.ServiceTypeDockerimage).
		SetEnvironmentID(suite.testEnv.ID).
		SetKubernetesSecret("test-service-secret").
		SaveX(suite.Ctx)

	suite.testService2 = suite.DB.Service.Create().
		SetName("Test Service 2").
		SetKubernetesName("test-service-2").
		SetType(schema.ServiceTypeDockerimage).
		SetEnvironmentID(suite.testEnv2.ID).
		SetKubernetesSecret("test-service-2-secret").
		SaveX(suite.Ctx)
}

func (suite *PermissionsPredicatesSuite) createTestUsers() {
	pwd, _ := bcrypt.GenerateFromPassword([]byte("test-password"), 1)

	// User with no permissions
	suite.noPermissionsUser = suite.DB.User.Create().
		SetEmail("noperms@example.com").
		SetPasswordHash(string(pwd)).
		SaveX(suite.Ctx)

	noPermsGroup := suite.DB.Group.Create().SetName("No Permissions").SaveX(suite.Ctx)
	suite.DB.User.UpdateOneID(suite.noPermissionsUser.ID).AddGroupIDs(noPermsGroup.ID).ExecX(suite.Ctx)

	// User with team viewer permissions
	suite.teamViewerUser = suite.DB.User.Create().
		SetEmail("teamviewer@example.com").
		SetPasswordHash(string(pwd)).
		SaveX(suite.Ctx)

	teamViewerGroup := suite.DB.Group.Create().SetName("Team Viewer").SaveX(suite.Ctx)
	teamViewerPerm := suite.DB.Permission.Create().
		SetAction(schema.ActionViewer).
		SetResourceType(schema.ResourceTypeTeam).
		SetResourceSelector(schema.ResourceSelector{ID: suite.testTeam.ID}).
		SaveX(suite.Ctx)
	suite.DB.Group.UpdateOneID(teamViewerGroup.ID).AddPermissionIDs(teamViewerPerm.ID).ExecX(suite.Ctx)
	suite.DB.User.UpdateOneID(suite.teamViewerUser.ID).AddGroupIDs(teamViewerGroup.ID).ExecX(suite.Ctx)

	// User with team admin permissions
	suite.teamAdminUser = suite.DB.User.Create().
		SetEmail("teamadmin@example.com").
		SetPasswordHash(string(pwd)).
		SaveX(suite.Ctx)

	teamAdminGroup := suite.DB.Group.Create().SetName("Team Admin").SaveX(suite.Ctx)
	teamAdminPerm := suite.DB.Permission.Create().
		SetAction(schema.ActionAdmin).
		SetResourceType(schema.ResourceTypeTeam).
		SetResourceSelector(schema.ResourceSelector{ID: suite.testTeam.ID}).
		SaveX(suite.Ctx)
	suite.DB.Group.UpdateOneID(teamAdminGroup.ID).AddPermissionIDs(teamAdminPerm.ID).ExecX(suite.Ctx)
	suite.DB.User.UpdateOneID(suite.teamAdminUser.ID).AddGroupIDs(teamAdminGroup.ID).ExecX(suite.Ctx)

	// User with project editor permissions
	suite.projectEditorUser = suite.DB.User.Create().
		SetEmail("projecteditor@example.com").
		SetPasswordHash(string(pwd)).
		SaveX(suite.Ctx)

	projectEditorGroup := suite.DB.Group.Create().SetName("Project Editor").SaveX(suite.Ctx)
	projectEditorPerm := suite.DB.Permission.Create().
		SetAction(schema.ActionEditor).
		SetResourceType(schema.ResourceTypeProject).
		SetResourceSelector(schema.ResourceSelector{ID: suite.testProject.ID}).
		SaveX(suite.Ctx)
	suite.DB.Group.UpdateOneID(projectEditorGroup.ID).AddPermissionIDs(projectEditorPerm.ID).ExecX(suite.Ctx)
	suite.DB.User.UpdateOneID(suite.projectEditorUser.ID).AddGroupIDs(projectEditorGroup.ID).ExecX(suite.Ctx)

	// User with environment viewer permissions
	suite.envViewerUser = suite.DB.User.Create().
		SetEmail("envviewer@example.com").
		SetPasswordHash(string(pwd)).
		SaveX(suite.Ctx)

	envViewerGroup := suite.DB.Group.Create().SetName("Environment Viewer").SaveX(suite.Ctx)
	envViewerPerm := suite.DB.Permission.Create().
		SetAction(schema.ActionViewer).
		SetResourceType(schema.ResourceTypeEnvironment).
		SetResourceSelector(schema.ResourceSelector{ID: suite.testEnv.ID}).
		SaveX(suite.Ctx)
	suite.DB.Group.UpdateOneID(envViewerGroup.ID).AddPermissionIDs(envViewerPerm.ID).ExecX(suite.Ctx)
	suite.DB.User.UpdateOneID(suite.envViewerUser.ID).AddGroupIDs(envViewerGroup.ID).ExecX(suite.Ctx)

	// User with service editor permissions
	suite.serviceEditorUser = suite.DB.User.Create().
		SetEmail("serviceeditor@example.com").
		SetPasswordHash(string(pwd)).
		SaveX(suite.Ctx)

	serviceEditorGroup := suite.DB.Group.Create().SetName("Service Editor").SaveX(suite.Ctx)
	serviceEditorPerm := suite.DB.Permission.Create().
		SetAction(schema.ActionEditor).
		SetResourceType(schema.ResourceTypeService).
		SetResourceSelector(schema.ResourceSelector{ID: suite.testService.ID}).
		SaveX(suite.Ctx)
	suite.DB.Group.UpdateOneID(serviceEditorGroup.ID).AddPermissionIDs(serviceEditorPerm.ID).ExecX(suite.Ctx)
	suite.DB.User.UpdateOneID(suite.serviceEditorUser.ID).AddGroupIDs(serviceEditorGroup.ID).ExecX(suite.Ctx)

	// User with superuser permissions
	suite.superuserUser = suite.DB.User.Create().
		SetEmail("superuser@example.com").
		SetPasswordHash(string(pwd)).
		SaveX(suite.Ctx)

	superuserGroup := suite.DB.Group.Create().SetName("Superuser").SaveX(suite.Ctx)
	superuserPerm := suite.DB.Permission.Create().
		SetAction(schema.ActionAdmin).
		SetResourceType(schema.ResourceTypeSystem).
		SetResourceSelector(schema.ResourceSelector{Superuser: true}).
		SaveX(suite.Ctx)
	suite.DB.Group.UpdateOneID(superuserGroup.ID).AddPermissionIDs(superuserPerm.ID).ExecX(suite.Ctx)
	suite.DB.User.UpdateOneID(suite.superuserUser.ID).AddGroupIDs(superuserGroup.ID).ExecX(suite.Ctx)

	// User with team superuser permissions
	suite.teamSuperuserUser = suite.DB.User.Create().
		SetEmail("teamsuperuser@example.com").
		SetPasswordHash(string(pwd)).
		SaveX(suite.Ctx)

	teamSuperuserGroup := suite.DB.Group.Create().SetName("Team Superuser").SaveX(suite.Ctx)
	teamSuperuserPerm := suite.DB.Permission.Create().
		SetAction(schema.ActionAdmin).
		SetResourceType(schema.ResourceTypeTeam).
		SetResourceSelector(schema.ResourceSelector{Superuser: true}).
		SaveX(suite.Ctx)
	suite.DB.Group.UpdateOneID(teamSuperuserGroup.ID).AddPermissionIDs(teamSuperuserPerm.ID).ExecX(suite.Ctx)
	suite.DB.User.UpdateOneID(suite.teamSuperuserUser.ID).AddGroupIDs(teamSuperuserGroup.ID).ExecX(suite.Ctx)

	// User with project superuser permissions
	suite.projectSuperuserUser = suite.DB.User.Create().
		SetEmail("projectsuperuser@example.com").
		SetPasswordHash(string(pwd)).
		SaveX(suite.Ctx)

	projectSuperuserGroup := suite.DB.Group.Create().SetName("Project Superuser").SaveX(suite.Ctx)
	projectSuperuserPerm := suite.DB.Permission.Create().
		SetAction(schema.ActionAdmin).
		SetResourceType(schema.ResourceTypeProject).
		SetResourceSelector(schema.ResourceSelector{Superuser: true}).
		SaveX(suite.Ctx)
	suite.DB.Group.UpdateOneID(projectSuperuserGroup.ID).AddPermissionIDs(projectSuperuserPerm.ID).ExecX(suite.Ctx)
	suite.DB.User.UpdateOneID(suite.projectSuperuserUser.ID).AddGroupIDs(projectSuperuserGroup.ID).ExecX(suite.Ctx)

	// User with environment superuser permissions
	suite.envSuperuserUser = suite.DB.User.Create().
		SetEmail("envsuperuser@example.com").
		SetPasswordHash(string(pwd)).
		SaveX(suite.Ctx)

	envSuperuserGroup := suite.DB.Group.Create().SetName("Environment Superuser").SaveX(suite.Ctx)
	envSuperuserPerm := suite.DB.Permission.Create().
		SetAction(schema.ActionAdmin).
		SetResourceType(schema.ResourceTypeEnvironment).
		SetResourceSelector(schema.ResourceSelector{Superuser: true}).
		SaveX(suite.Ctx)
	suite.DB.Group.UpdateOneID(envSuperuserGroup.ID).AddPermissionIDs(envSuperuserPerm.ID).ExecX(suite.Ctx)
	suite.DB.User.UpdateOneID(suite.envSuperuserUser.ID).AddGroupIDs(envSuperuserGroup.ID).ExecX(suite.Ctx)

	// User with service superuser permissions
	suite.serviceSuperuserUser = suite.DB.User.Create().
		SetEmail("servicesuperuser@example.com").
		SetPasswordHash(string(pwd)).
		SaveX(suite.Ctx)

	serviceSuperuserGroup := suite.DB.Group.Create().SetName("Service Superuser").SaveX(suite.Ctx)
	serviceSuperuserPerm := suite.DB.Permission.Create().
		SetAction(schema.ActionAdmin).
		SetResourceType(schema.ResourceTypeService).
		SetResourceSelector(schema.ResourceSelector{Superuser: true}).
		SaveX(suite.Ctx)
	suite.DB.Group.UpdateOneID(serviceSuperuserGroup.ID).AddPermissionIDs(serviceSuperuserPerm.ID).ExecX(suite.Ctx)
	suite.DB.User.UpdateOneID(suite.serviceSuperuserUser.ID).AddGroupIDs(serviceSuperuserGroup.ID).ExecX(suite.Ctx)
}

func (suite *PermissionsPredicatesSuite) TearDownTest() {
	suite.RepositoryBaseSuite.TearDownTest()
	suite.permissionsRepo = nil
}

// Test GetAccessibleTeamPredicates
func (suite *PermissionsPredicatesSuite) TestGetAccessibleTeamPredicates() {
	suite.Run("No Groups Returns False Predicate", func() {
		pred, err := suite.permissionsRepo.GetAccessibleTeamPredicates(
			suite.Ctx,
			suite.noPermissionsUser.ID,
			schema.ActionViewer,
		)
		suite.NoError(err)
		suite.NotNil(pred)

		// Test that predicate matches nothing
		teams, err := suite.DB.Team.Query().Where(pred).All(suite.Ctx)
		suite.NoError(err)
		suite.Empty(teams)
	})

	suite.Run("Team Superuser Returns Nil Predicate", func() {
		pred, err := suite.permissionsRepo.GetAccessibleTeamPredicates(
			suite.Ctx,
			suite.teamSuperuserUser.ID,
			schema.ActionViewer,
		)
		suite.NoError(err)
		suite.Nil(pred) // Nil means all teams accessible

		// Without predicate, should get all teams
		teams, err := suite.DB.Team.Query().All(suite.Ctx)
		suite.NoError(err)
		suite.Len(teams, 2) // Both test teams
	})

	suite.Run("Specific Team Permission", func() {
		pred, err := suite.permissionsRepo.GetAccessibleTeamPredicates(
			suite.Ctx,
			suite.teamViewerUser.ID,
			schema.ActionViewer,
		)
		suite.NoError(err)
		suite.NotNil(pred)

		// Should only return the specific team
		teams, err := suite.DB.Team.Query().Where(pred).All(suite.Ctx)
		suite.NoError(err)
		suite.Len(teams, 1)
		suite.Equal(suite.testTeam.ID, teams[0].ID)
	})

	suite.Run("Higher Permission Level Grants Lower", func() {
		pred, err := suite.permissionsRepo.GetAccessibleTeamPredicates(
			suite.Ctx,
			suite.teamAdminUser.ID,
			schema.ActionViewer, // Asking for viewer, but user has admin
		)
		suite.NoError(err)
		suite.NotNil(pred)

		teams, err := suite.DB.Team.Query().Where(pred).All(suite.Ctx)
		suite.NoError(err)
		suite.Len(teams, 1)
		suite.Equal(suite.testTeam.ID, teams[0].ID)
	})

	suite.Run("Permission Level Not Sufficient", func() {
		pred, err := suite.permissionsRepo.GetAccessibleTeamPredicates(
			suite.Ctx,
			suite.teamViewerUser.ID,
			schema.ActionAdmin, // Asking for admin, but user only has viewer
		)
		suite.NoError(err)
		suite.NotNil(pred)

		teams, err := suite.DB.Team.Query().Where(pred).All(suite.Ctx)
		suite.NoError(err)
		suite.Empty(teams)
	})

	suite.Run("Error when DB closed", func() {
		// Force a database operation in the predicate function to test error handling
		_, err := suite.permissionsRepo.GetAccessibleTeamPredicates(
			suite.Ctx,
			suite.teamViewerUser.ID,
			schema.ActionViewer,
		)
		suite.NoError(err) // This should succeed

		// Now close the DB and try again
		suite.DB.Close()
		pred, err := suite.permissionsRepo.GetAccessibleTeamPredicates(
			suite.Ctx,
			suite.teamViewerUser.ID,
			schema.ActionViewer,
		)
		suite.Error(err)
		suite.Nil(pred)
		suite.ErrorContains(err, "database is closed")
	})
}

// Test GetAccessibleProjectPredicates
func (suite *PermissionsPredicatesSuite) TestGetAccessibleProjectPredicates() {
	suite.Run("No Groups Returns False Predicate", func() {
		pred, err := suite.permissionsRepo.GetAccessibleProjectPredicates(
			suite.Ctx,
			suite.noPermissionsUser.ID,
			schema.ActionViewer,
		)
		suite.NoError(err)
		suite.NotNil(pred)

		// Test that predicate matches nothing
		projects, err := suite.DB.Project.Query().Where(pred).All(suite.Ctx)
		suite.NoError(err)
		suite.Empty(projects)
	})

	suite.Run("Project Superuser Returns Nil Predicate", func() {
		pred, err := suite.permissionsRepo.GetAccessibleProjectPredicates(
			suite.Ctx,
			suite.projectSuperuserUser.ID,
			schema.ActionViewer,
		)
		suite.NoError(err)
		suite.Nil(pred) // Nil means all projects accessible
	})

	suite.Run("Team Superuser Returns Nil Predicate", func() {
		pred, err := suite.permissionsRepo.GetAccessibleProjectPredicates(
			suite.Ctx,
			suite.teamSuperuserUser.ID,
			schema.ActionViewer,
		)
		suite.NoError(err)
		suite.Nil(pred) // Team superuser grants access to all projects
	})

	suite.Run("Specific Project Permission", func() {
		pred, err := suite.permissionsRepo.GetAccessibleProjectPredicates(
			suite.Ctx,
			suite.projectEditorUser.ID,
			schema.ActionViewer,
		)
		suite.NoError(err)
		suite.NotNil(pred)

		// Should only return the specific project
		projects, err := suite.DB.Project.Query().Where(pred).All(suite.Ctx)
		suite.NoError(err)
		suite.Len(projects, 1)
		suite.Equal(suite.testProject.ID, projects[0].ID)
	})

	suite.Run("Team Permission Grants Project Access", func() {
		pred, err := suite.permissionsRepo.GetAccessibleProjectPredicates(
			suite.Ctx,
			suite.teamViewerUser.ID,
			schema.ActionViewer,
		)
		suite.NoError(err)
		suite.NotNil(pred)

		// Should return projects in the accessible team
		projects, err := suite.DB.Project.Query().Where(pred).All(suite.Ctx)
		suite.NoError(err)
		suite.Len(projects, 1)
		suite.Equal(suite.testProject.ID, projects[0].ID)
	})

	suite.Run("Error when DB closed", func() {
		// First verify it works
		_, err := suite.permissionsRepo.GetAccessibleProjectPredicates(
			suite.Ctx,
			suite.projectEditorUser.ID,
			schema.ActionViewer,
		)
		suite.NoError(err)

		// Now close the DB and try again
		suite.DB.Close()
		pred, err := suite.permissionsRepo.GetAccessibleProjectPredicates(
			suite.Ctx,
			suite.projectEditorUser.ID,
			schema.ActionViewer,
		)
		suite.Error(err)
		suite.Nil(pred)
		suite.ErrorContains(err, "database is closed")
	})
}

// Test GetAccessibleEnvironmentPredicates
func (suite *PermissionsPredicatesSuite) TestGetAccessibleEnvironmentPredicates() {
	suite.Run("No Groups Returns False Predicate", func() {
		pred, err := suite.permissionsRepo.GetAccessibleEnvironmentPredicates(
			suite.Ctx,
			suite.noPermissionsUser.ID,
			schema.ActionViewer,
			nil,
		)
		suite.NoError(err)
		suite.NotNil(pred)

		// Test that predicate matches nothing
		environments, err := suite.DB.Environment.Query().Where(pred).All(suite.Ctx)
		suite.NoError(err)
		suite.Empty(environments)
	})

	suite.Run("Environment Superuser Returns Nil Predicate", func() {
		pred, err := suite.permissionsRepo.GetAccessibleEnvironmentPredicates(
			suite.Ctx,
			suite.envSuperuserUser.ID,
			schema.ActionViewer,
			nil,
		)
		suite.NoError(err)
		suite.Nil(pred) // Nil means all environments accessible
	})

	suite.Run("Environment Superuser with Project Scope", func() {
		pred, err := suite.permissionsRepo.GetAccessibleEnvironmentPredicates(
			suite.Ctx,
			suite.envSuperuserUser.ID,
			schema.ActionViewer,
			&suite.testProject.ID,
		)
		suite.NoError(err)
		suite.NotNil(pred) // Should return scoped predicate

		// Should only return environments in the specified project
		environments, err := suite.DB.Environment.Query().Where(pred).All(suite.Ctx)
		suite.NoError(err)
		suite.Len(environments, 1)
		suite.Equal(suite.testEnv.ID, environments[0].ID)
	})

	suite.Run("Specific Environment Permission", func() {
		pred, err := suite.permissionsRepo.GetAccessibleEnvironmentPredicates(
			suite.Ctx,
			suite.envViewerUser.ID,
			schema.ActionViewer,
			nil,
		)
		suite.NoError(err)
		suite.NotNil(pred)

		// Should only return the specific environment
		environments, err := suite.DB.Environment.Query().Where(pred).All(suite.Ctx)
		suite.NoError(err)
		suite.Len(environments, 1)
		suite.Equal(suite.testEnv.ID, environments[0].ID)
	})

	suite.Run("Project Permission Grants Environment Access", func() {
		pred, err := suite.permissionsRepo.GetAccessibleEnvironmentPredicates(
			suite.Ctx,
			suite.projectEditorUser.ID,
			schema.ActionViewer,
			nil,
		)
		suite.NoError(err)
		suite.NotNil(pred)

		// Should return environments in the accessible project
		environments, err := suite.DB.Environment.Query().Where(pred).All(suite.Ctx)
		suite.NoError(err)
		suite.Len(environments, 1)
		suite.Equal(suite.testEnv.ID, environments[0].ID)
	})

	suite.Run("Team Permission Grants Environment Access", func() {
		pred, err := suite.permissionsRepo.GetAccessibleEnvironmentPredicates(
			suite.Ctx,
			suite.teamViewerUser.ID,
			schema.ActionViewer,
			nil,
		)
		suite.NoError(err)
		suite.NotNil(pred)

		// Should return environments in projects owned by accessible team
		environments, err := suite.DB.Environment.Query().Where(pred).All(suite.Ctx)
		suite.NoError(err)
		suite.Len(environments, 1)
		suite.Equal(suite.testEnv.ID, environments[0].ID)
	})

	suite.Run("Project Scope Filtering", func() {
		pred, err := suite.permissionsRepo.GetAccessibleEnvironmentPredicates(
			suite.Ctx,
			suite.teamSuperuserUser.ID, // Has access to all teams
			schema.ActionViewer,
			&suite.testProject2.ID, // But scoped to specific project
		)
		suite.NoError(err)
		suite.NotNil(pred)

		// Should only return environments in the specified project
		environments, err := suite.DB.Environment.Query().Where(pred).All(suite.Ctx)
		suite.NoError(err)
		suite.Len(environments, 1)
		suite.Equal(suite.testEnv2.ID, environments[0].ID)
	})

	suite.Run("Error when DB closed", func() {
		// First verify it works
		_, err := suite.permissionsRepo.GetAccessibleEnvironmentPredicates(
			suite.Ctx,
			suite.envViewerUser.ID,
			schema.ActionViewer,
			nil,
		)
		suite.NoError(err)

		// Now close the DB and try again
		suite.DB.Close()
		pred, err := suite.permissionsRepo.GetAccessibleEnvironmentPredicates(
			suite.Ctx,
			suite.envViewerUser.ID,
			schema.ActionViewer,
			nil,
		)
		suite.Error(err)
		suite.Nil(pred)
		suite.ErrorContains(err, "database is closed")
	})
}

// Test GetAccessibleServicePredicates
func (suite *PermissionsPredicatesSuite) TestGetAccessibleServicePredicates() {
	suite.Run("No Groups Returns False Predicate", func() {
		pred, err := suite.permissionsRepo.GetAccessibleServicePredicates(
			suite.Ctx,
			suite.noPermissionsUser.ID,
			schema.ActionViewer,
			nil,
		)
		suite.NoError(err)
		suite.NotNil(pred)

		// Test that predicate matches nothing
		services, err := suite.DB.Service.Query().Where(pred).All(suite.Ctx)
		suite.NoError(err)
		suite.Empty(services)
	})

	suite.Run("Service Superuser Returns Nil Predicate", func() {
		pred, err := suite.permissionsRepo.GetAccessibleServicePredicates(
			suite.Ctx,
			suite.serviceSuperuserUser.ID,
			schema.ActionViewer,
			nil,
		)
		suite.NoError(err)
		suite.Nil(pred) // Nil means all services accessible
	})

	suite.Run("Service Superuser with Environment Scope", func() {
		pred, err := suite.permissionsRepo.GetAccessibleServicePredicates(
			suite.Ctx,
			suite.serviceSuperuserUser.ID,
			schema.ActionViewer,
			&suite.testEnv.ID,
		)
		suite.NoError(err)
		suite.NotNil(pred) // Should return scoped predicate

		// Should only return services in the specified environment
		services, err := suite.DB.Service.Query().Where(pred).All(suite.Ctx)
		suite.NoError(err)
		suite.Len(services, 1)
		suite.Equal(suite.testService.ID, services[0].ID)
	})

	suite.Run("Specific Service Permission", func() {
		pred, err := suite.permissionsRepo.GetAccessibleServicePredicates(
			suite.Ctx,
			suite.serviceEditorUser.ID,
			schema.ActionViewer,
			nil,
		)
		suite.NoError(err)
		suite.NotNil(pred)

		// Should only return the specific service
		services, err := suite.DB.Service.Query().Where(pred).All(suite.Ctx)
		suite.NoError(err)
		suite.Len(services, 1)
		suite.Equal(suite.testService.ID, services[0].ID)
	})

	suite.Run("Environment Permission Grants Service Access", func() {
		pred, err := suite.permissionsRepo.GetAccessibleServicePredicates(
			suite.Ctx,
			suite.envViewerUser.ID,
			schema.ActionViewer,
			nil,
		)
		suite.NoError(err)
		suite.NotNil(pred)

		// Should return services in the accessible environment
		services, err := suite.DB.Service.Query().Where(pred).All(suite.Ctx)
		suite.NoError(err)
		suite.Len(services, 1)
		suite.Equal(suite.testService.ID, services[0].ID)
	})

	suite.Run("Project Permission Grants Service Access", func() {
		pred, err := suite.permissionsRepo.GetAccessibleServicePredicates(
			suite.Ctx,
			suite.projectEditorUser.ID,
			schema.ActionViewer,
			nil,
		)
		suite.NoError(err)
		suite.NotNil(pred)

		// Should return services in environments owned by accessible project
		services, err := suite.DB.Service.Query().Where(pred).All(suite.Ctx)
		suite.NoError(err)
		suite.Len(services, 1)
		suite.Equal(suite.testService.ID, services[0].ID)
	})

	suite.Run("Team Permission Grants Service Access", func() {
		pred, err := suite.permissionsRepo.GetAccessibleServicePredicates(
			suite.Ctx,
			suite.teamViewerUser.ID,
			schema.ActionViewer,
			nil,
		)
		suite.NoError(err)
		suite.NotNil(pred)

		// Should return services in environments/projects owned by accessible team
		services, err := suite.DB.Service.Query().Where(pred).All(suite.Ctx)
		suite.NoError(err)
		suite.Len(services, 1)
		suite.Equal(suite.testService.ID, services[0].ID)
	})

	suite.Run("Environment Scope Filtering", func() {
		pred, err := suite.permissionsRepo.GetAccessibleServicePredicates(
			suite.Ctx,
			suite.teamSuperuserUser.ID, // Has access to all teams
			schema.ActionViewer,
			&suite.testEnv2.ID, // But scoped to specific environment
		)
		suite.NoError(err)
		suite.NotNil(pred)

		// Should only return services in the specified environment
		services, err := suite.DB.Service.Query().Where(pred).All(suite.Ctx)
		suite.NoError(err)
		suite.Len(services, 1)
		suite.Equal(suite.testService2.ID, services[0].ID)
	})

	suite.Run("Error when DB closed", func() {
		// First verify it works
		_, err := suite.permissionsRepo.GetAccessibleServicePredicates(
			suite.Ctx,
			suite.serviceEditorUser.ID,
			schema.ActionViewer,
			nil,
		)
		suite.NoError(err)

		// Now close the DB and try again
		suite.DB.Close()
		pred, err := suite.permissionsRepo.GetAccessibleServicePredicates(
			suite.Ctx,
			suite.serviceEditorUser.ID,
			schema.ActionViewer,
			nil,
		)
		suite.Error(err)
		suite.Nil(pred)
		suite.ErrorContains(err, "database is closed")
	})
}

// Test complex hierarchical scenarios
func (suite *PermissionsPredicatesSuite) TestComplexHierarchicalScenarios() {
	suite.Run("Multiple Permission Sources", func() {
		// Create a user with both specific project permission and team permission for different resources
		pwd, _ := bcrypt.GenerateFromPassword([]byte("test"), 1)
		multiPermUser := suite.DB.User.Create().
			SetEmail("multiperm@example.com").
			SetPasswordHash(string(pwd)).
			SaveX(suite.Ctx)

		// Group with specific project permission
		group1 := suite.DB.Group.Create().SetName("Multi Group 1").SaveX(suite.Ctx)
		perm1 := suite.DB.Permission.Create().
			SetAction(schema.ActionViewer).
			SetResourceType(schema.ResourceTypeProject).
			SetResourceSelector(schema.ResourceSelector{ID: suite.testProject.ID}).
			SaveX(suite.Ctx)
		suite.DB.Group.UpdateOneID(group1.ID).AddPermissionIDs(perm1.ID).ExecX(suite.Ctx)

		// Group with specific team permission for different team
		group2 := suite.DB.Group.Create().SetName("Multi Group 2").SaveX(suite.Ctx)
		perm2 := suite.DB.Permission.Create().
			SetAction(schema.ActionEditor).
			SetResourceType(schema.ResourceTypeTeam).
			SetResourceSelector(schema.ResourceSelector{ID: suite.testTeam2.ID}).
			SaveX(suite.Ctx)
		suite.DB.Group.UpdateOneID(group2.ID).AddPermissionIDs(perm2.ID).ExecX(suite.Ctx)

		// Add user to both groups
		suite.DB.User.UpdateOneID(multiPermUser.ID).AddGroupIDs(group1.ID, group2.ID).ExecX(suite.Ctx)

		// Test project access
		pred, err := suite.permissionsRepo.GetAccessibleProjectPredicates(
			suite.Ctx,
			multiPermUser.ID,
			schema.ActionViewer,
		)
		suite.NoError(err)
		suite.NotNil(pred)

		// Only query if predicate is not nil
		var projects []*ent.Project
		if pred != nil {
			projects, err = suite.DB.Project.Query().Where(pred).All(suite.Ctx)
			suite.NoError(err)
		} else {
			// Nil predicate means all projects accessible
			projects, err = suite.DB.Project.Query().All(suite.Ctx)
			suite.NoError(err)
		}

		suite.Len(projects, 2) // Should access both projects (one directly, one via team)

		projectIDs := make([]uuid.UUID, len(projects))
		for i, p := range projects {
			projectIDs[i] = p.ID
		}
		suite.Contains(projectIDs, suite.testProject.ID)
		suite.Contains(projectIDs, suite.testProject2.ID)
	})

	suite.Run("Permission Level Inheritance", func() {
		// User has admin on team, should have admin on all child resources
		pred, err := suite.permissionsRepo.GetAccessibleServicePredicates(
			suite.Ctx,
			suite.teamAdminUser.ID,
			schema.ActionAdmin, // Requesting admin level
			nil,
		)
		suite.NoError(err)
		suite.NotNil(pred)

		services, err := suite.DB.Service.Query().Where(pred).All(suite.Ctx)
		suite.NoError(err)
		suite.Len(services, 1)
		suite.Equal(suite.testService.ID, services[0].ID)
	})

	suite.Run("Mixed Superuser and Specific Permissions", func() {
		// Create user with both superuser on teams and specific permission on different resource type
		pwd, _ := bcrypt.GenerateFromPassword([]byte("test"), 1)
		mixedUser := suite.DB.User.Create().
			SetEmail("mixed@example.com").
			SetPasswordHash(string(pwd)).
			SaveX(suite.Ctx)

		// Group with team superuser
		group1 := suite.DB.Group.Create().SetName("Mixed Group 1").SaveX(suite.Ctx)
		perm1 := suite.DB.Permission.Create().
			SetAction(schema.ActionAdmin).
			SetResourceType(schema.ResourceTypeTeam).
			SetResourceSelector(schema.ResourceSelector{Superuser: true}).
			SaveX(suite.Ctx)
		suite.DB.Group.UpdateOneID(group1.ID).AddPermissionIDs(perm1.ID).ExecX(suite.Ctx)

		// Group with specific service permission (should be redundant with team superuser)
		group2 := suite.DB.Group.Create().SetName("Mixed Group 2").SaveX(suite.Ctx)
		perm2 := suite.DB.Permission.Create().
			SetAction(schema.ActionViewer).
			SetResourceType(schema.ResourceTypeService).
			SetResourceSelector(schema.ResourceSelector{ID: suite.testService2.ID}).
			SaveX(suite.Ctx)
		suite.DB.Group.UpdateOneID(group2.ID).AddPermissionIDs(perm2.ID).ExecX(suite.Ctx)

		suite.DB.User.UpdateOneID(mixedUser.ID).AddGroupIDs(group1.ID, group2.ID).ExecX(suite.Ctx)

		// Should have access to all services (via team superuser)
		pred, err := suite.permissionsRepo.GetAccessibleServicePredicates(
			suite.Ctx,
			mixedUser.ID,
			schema.ActionViewer,
			nil,
		)
		suite.NoError(err)
		suite.Nil(pred) // Superuser should return nil predicate

		// Verify by checking without predicate
		services, err := suite.DB.Service.Query().All(suite.Ctx)
		suite.NoError(err)
		suite.Len(services, 2) // Should see all services
	})
}

func TestPermissionsPredicatesSuite(t *testing.T) {
	suite.Run(t, new(PermissionsPredicatesSuite))
}
