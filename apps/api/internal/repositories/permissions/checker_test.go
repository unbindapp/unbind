package permissions_repo

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	deployment_repo "github.com/unbindapp/unbind-api/internal/repositories/deployment"
	environment_repo "github.com/unbindapp/unbind-api/internal/repositories/environment"
	project_repo "github.com/unbindapp/unbind-api/internal/repositories/project"
	service_repo "github.com/unbindapp/unbind-api/internal/repositories/service"
	team_repo "github.com/unbindapp/unbind-api/internal/repositories/team"
	user_repo "github.com/unbindapp/unbind-api/internal/repositories/user"
	"golang.org/x/crypto/bcrypt"
)

type PermissionsCheckerSuite struct {
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

	// Test groups and permissions
	testGroup             *ent.Group
	testGroupNoPerms      *ent.Group
	testGroupSuperuser    *ent.Group
	teamAdminGroup        *ent.Group
	projectEditorGroup    *ent.Group
	environmentViewGroup  *ent.Group
	serviceSpecificGroup  *ent.Group
	hierarchicalTestGroup *ent.Group
}

func (suite *PermissionsCheckerSuite) SetupTest() {
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

	// Create test groups with various permission configurations
	suite.setupTestGroups()
}

func (suite *PermissionsCheckerSuite) setupTestGroups() {
	// Group with no permissions
	suite.testGroupNoPerms = suite.DB.Group.Create().
		SetName("No Permissions Group").
		SaveX(suite.Ctx)

	// Group with specific team permissions
	suite.testGroup = suite.DB.Group.Create().
		SetName("Test Group").
		SaveX(suite.Ctx)

	// Create specific team permission
	teamPerm := suite.DB.Permission.Create().
		SetAction(schema.ActionViewer).
		SetResourceType(schema.ResourceTypeTeam).
		SetResourceSelector(schema.ResourceSelector{ID: suite.testTeam.ID}).
		SaveX(suite.Ctx)

	suite.DB.Group.UpdateOneID(suite.testGroup.ID).
		AddPermissionIDs(teamPerm.ID).
		ExecX(suite.Ctx)

	// Group with superuser permissions
	suite.testGroupSuperuser = suite.DB.Group.Create().
		SetName("Superuser Group").
		SaveX(suite.Ctx)

	superuserPerm := suite.DB.Permission.Create().
		SetAction(schema.ActionAdmin).
		SetResourceType(schema.ResourceTypeSystem).
		SetResourceSelector(schema.ResourceSelector{Superuser: true}).
		SaveX(suite.Ctx)

	suite.DB.Group.UpdateOneID(suite.testGroupSuperuser.ID).
		AddPermissionIDs(superuserPerm.ID).
		ExecX(suite.Ctx)

	// Group with team admin permissions
	suite.teamAdminGroup = suite.DB.Group.Create().
		SetName("Team Admin Group").
		SaveX(suite.Ctx)

	teamAdminPerm := suite.DB.Permission.Create().
		SetAction(schema.ActionAdmin).
		SetResourceType(schema.ResourceTypeTeam).
		SetResourceSelector(schema.ResourceSelector{ID: suite.testTeam.ID}).
		SaveX(suite.Ctx)

	suite.DB.Group.UpdateOneID(suite.teamAdminGroup.ID).
		AddPermissionIDs(teamAdminPerm.ID).
		ExecX(suite.Ctx)

	// Group with project editor permissions
	suite.projectEditorGroup = suite.DB.Group.Create().
		SetName("Project Editor Group").
		SaveX(suite.Ctx)

	projectEditorPerm := suite.DB.Permission.Create().
		SetAction(schema.ActionEditor).
		SetResourceType(schema.ResourceTypeProject).
		SetResourceSelector(schema.ResourceSelector{ID: suite.testProject.ID}).
		SaveX(suite.Ctx)

	suite.DB.Group.UpdateOneID(suite.projectEditorGroup.ID).
		AddPermissionIDs(projectEditorPerm.ID).
		ExecX(suite.Ctx)

	// Group with environment view permissions
	suite.environmentViewGroup = suite.DB.Group.Create().
		SetName("Environment View Group").
		SaveX(suite.Ctx)

	envViewPerm := suite.DB.Permission.Create().
		SetAction(schema.ActionViewer).
		SetResourceType(schema.ResourceTypeEnvironment).
		SetResourceSelector(schema.ResourceSelector{ID: suite.testEnv.ID}).
		SaveX(suite.Ctx)

	suite.DB.Group.UpdateOneID(suite.environmentViewGroup.ID).
		AddPermissionIDs(envViewPerm.ID).
		ExecX(suite.Ctx)

	// Group with specific service permissions
	suite.serviceSpecificGroup = suite.DB.Group.Create().
		SetName("Service Specific Group").
		SaveX(suite.Ctx)

	serviceSpecificPerm := suite.DB.Permission.Create().
		SetAction(schema.ActionEditor).
		SetResourceType(schema.ResourceTypeService).
		SetResourceSelector(schema.ResourceSelector{ID: suite.testService.ID}).
		SaveX(suite.Ctx)

	suite.DB.Group.UpdateOneID(suite.serviceSpecificGroup.ID).
		AddPermissionIDs(serviceSpecificPerm.ID).
		ExecX(suite.Ctx)

	// Group for testing hierarchical permissions
	suite.hierarchicalTestGroup = suite.DB.Group.Create().
		SetName("Hierarchical Test Group").
		SaveX(suite.Ctx)

	// This group has team permissions which should grant access to projects/environments/services
	teamHierarchicalPerm := suite.DB.Permission.Create().
		SetAction(schema.ActionViewer).
		SetResourceType(schema.ResourceTypeTeam).
		SetResourceSelector(schema.ResourceSelector{ID: suite.testTeam.ID}).
		SaveX(suite.Ctx)

	suite.DB.Group.UpdateOneID(suite.hierarchicalTestGroup.ID).
		AddPermissionIDs(teamHierarchicalPerm.ID).
		ExecX(suite.Ctx)

	// Add users to groups
	suite.DB.User.UpdateOneID(suite.testUser.ID).
		AddGroupIDs(suite.testGroup.ID, suite.projectEditorGroup.ID).
		ExecX(suite.Ctx)

	suite.DB.User.UpdateOneID(suite.testUser2.ID).
		AddGroupIDs(suite.testGroupNoPerms.ID).
		ExecX(suite.Ctx)
}

func (suite *PermissionsCheckerSuite) TearDownTest() {
	suite.RepositoryBaseSuite.TearDownTest()
	suite.permissionsRepo = nil
	suite.userRepo = nil
	suite.projectRepo = nil
	suite.environmentRepo = nil
	suite.serviceRepo = nil
	suite.teamRepo = nil
	suite.deploymentRepo = nil
}

// Test the basic Check method
func (suite *PermissionsCheckerSuite) TestCheck() {
	suite.Run("Check Success with Valid Permission", func() {
		checks := []PermissionCheck{
			{
				Action:       schema.ActionViewer,
				ResourceType: schema.ResourceTypeTeam,
				ResourceID:   suite.testTeam.ID,
			},
		}

		err := suite.permissionsRepo.Check(suite.Ctx, suite.testUser.ID, checks)
		suite.NoError(err)
	})

	suite.Run("Check Success with Empty Checks", func() {
		checks := []PermissionCheck{}
		err := suite.permissionsRepo.Check(suite.Ctx, suite.testUser.ID, checks)
		suite.NoError(err)
	})

	suite.Run("Check Failure with No Groups", func() {
		// Create a user with no groups
		pwd, _ := bcrypt.GenerateFromPassword([]byte("no-groups"), 1)
		userNoGroups := suite.DB.User.Create().
			SetEmail("nogroups@example.com").
			SetPasswordHash(string(pwd)).
			SaveX(suite.Ctx)

		checks := []PermissionCheck{
			{
				Action:       schema.ActionViewer,
				ResourceType: schema.ResourceTypeTeam,
				ResourceID:   suite.testTeam.ID,
			},
		}

		err := suite.permissionsRepo.Check(suite.Ctx, userNoGroups.ID, checks)
		suite.Error(err)
		suite.Equal(errdefs.ErrUnauthorized, err)
	})

	suite.Run("Check Failure with No Permission", func() {
		checks := []PermissionCheck{
			{
				Action:       schema.ActionViewer,
				ResourceType: schema.ResourceTypeTeam,
				ResourceID:   suite.testTeam2.ID, // Different team
			},
		}

		err := suite.permissionsRepo.Check(suite.Ctx, suite.testUser.ID, checks)
		suite.Error(err)
		suite.Equal(errdefs.ErrUnauthorized, err)
	})

	suite.Run("Check Success with Implied Permissions", func() {
		// User has editor permission on project, should pass viewer check
		checks := []PermissionCheck{
			{
				Action:       schema.ActionViewer,
				ResourceType: schema.ResourceTypeProject,
				ResourceID:   suite.testProject.ID,
			},
		}

		err := suite.permissionsRepo.Check(suite.Ctx, suite.testUser.ID, checks)
		suite.NoError(err)
	})

	suite.Run("Check Skip with Empty Action or ResourceType", func() {
		checks := []PermissionCheck{
			{
				Action:       "", // Empty action
				ResourceType: schema.ResourceTypeTeam,
				ResourceID:   suite.testTeam.ID,
			},
			{
				Action:       schema.ActionViewer,
				ResourceType: "", // Empty resource type
				ResourceID:   suite.testTeam.ID,
			},
			{
				Action:       schema.ActionViewer,
				ResourceType: schema.ResourceTypeTeam,
				ResourceID:   suite.testTeam.ID, // Valid check
			},
		}

		err := suite.permissionsRepo.Check(suite.Ctx, suite.testUser.ID, checks)
		suite.NoError(err) // Should pass because of the valid check
	})

	suite.Run("Check Error when DB closed", func() {
		checks := []PermissionCheck{
			{
				Action:       schema.ActionViewer,
				ResourceType: schema.ResourceTypeTeam,
				ResourceID:   suite.testTeam.ID,
			},
		}

		suite.DB.Close()
		err := suite.permissionsRepo.Check(suite.Ctx, suite.testUser.ID, checks)
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

// Test hierarchical permissions
func (suite *PermissionsCheckerSuite) TestHierarchicalPermissions() {
	// Add user to hierarchical test group
	suite.DB.User.UpdateOneID(suite.testUser.ID).
		AddGroupIDs(suite.hierarchicalTestGroup.ID).
		ExecX(suite.Ctx)

	suite.Run("Team Permission Grants Project Access", func() {
		checks := []PermissionCheck{
			{
				Action:       schema.ActionViewer,
				ResourceType: schema.ResourceTypeProject,
				ResourceID:   suite.testProject.ID,
			},
		}

		err := suite.permissionsRepo.Check(suite.Ctx, suite.testUser.ID, checks)
		suite.NoError(err)
	})

	suite.Run("Team Permission Grants Environment Access", func() {
		checks := []PermissionCheck{
			{
				Action:       schema.ActionViewer,
				ResourceType: schema.ResourceTypeEnvironment,
				ResourceID:   suite.testEnv.ID,
			},
		}

		err := suite.permissionsRepo.Check(suite.Ctx, suite.testUser.ID, checks)
		suite.NoError(err)
	})

	suite.Run("Team Permission Grants Service Access", func() {
		checks := []PermissionCheck{
			{
				Action:       schema.ActionViewer,
				ResourceType: schema.ResourceTypeService,
				ResourceID:   suite.testService.ID,
			},
		}

		err := suite.permissionsRepo.Check(suite.Ctx, suite.testUser.ID, checks)
		suite.NoError(err)
	})

	suite.Run("Team Permission Does Not Grant Access to Different Team Resources", func() {
		checks := []PermissionCheck{
			{
				Action:       schema.ActionViewer,
				ResourceType: schema.ResourceTypeProject,
				ResourceID:   suite.testProject2.ID, // Different team
			},
		}

		err := suite.permissionsRepo.Check(suite.Ctx, suite.testUser.ID, checks)
		suite.Error(err)
		suite.Equal(errdefs.ErrUnauthorized, err)
	})
}

// Test superuser permissions
func (suite *PermissionsCheckerSuite) TestSuperuserPermissions() {
	// Create separate superuser groups for different resource types since
	// system superusers only have access to system resources, not teams/projects/etc.

	// Team superuser group
	teamSuperuserGroup := suite.DB.Group.Create().
		SetName("Team Superuser Group").
		SaveX(suite.Ctx)

	teamSuperuserPerm := suite.DB.Permission.Create().
		SetAction(schema.ActionAdmin).
		SetResourceType(schema.ResourceTypeTeam).
		SetResourceSelector(schema.ResourceSelector{Superuser: true}).
		SaveX(suite.Ctx)

	suite.DB.Group.UpdateOneID(teamSuperuserGroup.ID).
		AddPermissionIDs(teamSuperuserPerm.ID).
		ExecX(suite.Ctx)

	// Project superuser group
	projectSuperuserGroup := suite.DB.Group.Create().
		SetName("Project Superuser Group").
		SaveX(suite.Ctx)

	projectSuperuserPerm := suite.DB.Permission.Create().
		SetAction(schema.ActionAdmin).
		SetResourceType(schema.ResourceTypeProject).
		SetResourceSelector(schema.ResourceSelector{Superuser: true}).
		SaveX(suite.Ctx)

	suite.DB.Group.UpdateOneID(projectSuperuserGroup.ID).
		AddPermissionIDs(projectSuperuserPerm.ID).
		ExecX(suite.Ctx)

	// Environment superuser group
	environmentSuperuserGroup := suite.DB.Group.Create().
		SetName("Environment Superuser Group").
		SaveX(suite.Ctx)

	environmentSuperuserPerm := suite.DB.Permission.Create().
		SetAction(schema.ActionAdmin).
		SetResourceType(schema.ResourceTypeEnvironment).
		SetResourceSelector(schema.ResourceSelector{Superuser: true}).
		SaveX(suite.Ctx)

	suite.DB.Group.UpdateOneID(environmentSuperuserGroup.ID).
		AddPermissionIDs(environmentSuperuserPerm.ID).
		ExecX(suite.Ctx)

	// Service superuser group
	serviceSuperuserGroup := suite.DB.Group.Create().
		SetName("Service Superuser Group").
		SaveX(suite.Ctx)

	serviceSuperuserPerm := suite.DB.Permission.Create().
		SetAction(schema.ActionAdmin).
		SetResourceType(schema.ResourceTypeService).
		SetResourceSelector(schema.ResourceSelector{Superuser: true}).
		SaveX(suite.Ctx)

	suite.DB.Group.UpdateOneID(serviceSuperuserGroup.ID).
		AddPermissionIDs(serviceSuperuserPerm.ID).
		ExecX(suite.Ctx)

	suite.Run("Team Superuser Can Access Any Team", func() {
		// Add user to team superuser group
		suite.DB.User.UpdateOneID(suite.testUser.ID).
			AddGroupIDs(teamSuperuserGroup.ID).
			ExecX(suite.Ctx)

		checks := []PermissionCheck{
			{
				Action:       schema.ActionAdmin,
				ResourceType: schema.ResourceTypeTeam,
				ResourceID:   suite.testTeam2.ID,
			},
		}

		err := suite.permissionsRepo.Check(suite.Ctx, suite.testUser.ID, checks)
		suite.NoError(err)
	})

	suite.Run("Project Superuser Can Access Any Project", func() {
		// Add user to project superuser group
		suite.DB.User.UpdateOneID(suite.testUser.ID).
			AddGroupIDs(projectSuperuserGroup.ID).
			ExecX(suite.Ctx)

		checks := []PermissionCheck{
			{
				Action:       schema.ActionAdmin,
				ResourceType: schema.ResourceTypeProject,
				ResourceID:   suite.testProject2.ID,
			},
		}

		err := suite.permissionsRepo.Check(suite.Ctx, suite.testUser.ID, checks)
		suite.NoError(err)
	})

	suite.Run("Environment Superuser Can Access Any Environment", func() {
		// Add user to environment superuser group
		suite.DB.User.UpdateOneID(suite.testUser.ID).
			AddGroupIDs(environmentSuperuserGroup.ID).
			ExecX(suite.Ctx)

		checks := []PermissionCheck{
			{
				Action:       schema.ActionAdmin,
				ResourceType: schema.ResourceTypeEnvironment,
				ResourceID:   suite.testEnv2.ID,
			},
		}

		err := suite.permissionsRepo.Check(suite.Ctx, suite.testUser.ID, checks)
		suite.NoError(err)
	})

	suite.Run("Service Superuser Can Access Any Service", func() {
		// Add user to service superuser group
		suite.DB.User.UpdateOneID(suite.testUser.ID).
			AddGroupIDs(serviceSuperuserGroup.ID).
			ExecX(suite.Ctx)

		checks := []PermissionCheck{
			{
				Action:       schema.ActionAdmin,
				ResourceType: schema.ResourceTypeService,
				ResourceID:   suite.testService2.ID,
			},
		}

		err := suite.permissionsRepo.Check(suite.Ctx, suite.testUser.ID, checks)
		suite.NoError(err)
	})

	suite.Run("System Superuser Cannot Access Teams", func() {
		// Create a clean user with only system superuser permissions
		pwd, _ := bcrypt.GenerateFromPassword([]byte("system-superuser"), 1)
		systemSuperuserUser := suite.DB.User.Create().
			SetEmail("systemsuperuser@example.com").
			SetPasswordHash(string(pwd)).
			SaveX(suite.Ctx)

		// Add this clean user to system superuser group only
		suite.DB.User.UpdateOneID(systemSuperuserUser.ID).
			AddGroupIDs(suite.testGroupSuperuser.ID).
			ExecX(suite.Ctx)

		checks := []PermissionCheck{
			{
				Action:       schema.ActionAdmin,
				ResourceType: schema.ResourceTypeTeam,
				ResourceID:   suite.testTeam2.ID,
			},
		}

		err := suite.permissionsRepo.Check(suite.Ctx, systemSuperuserUser.ID, checks)
		suite.Error(err) // System superuser should NOT have access to teams
		suite.Equal(errdefs.ErrUnauthorized, err)
	})
}

// Test getImpliedActions
func (suite *PermissionsCheckerSuite) TestGetImpliedActions() {
	suite.Run("Admin Implies Only Admin", func() {
		actions := suite.permissionsRepo.getImpliedActions(schema.ActionAdmin)
		suite.Equal([]schema.PermittedAction{schema.ActionAdmin}, actions)
	})

	suite.Run("Editor Implies Editor and Admin", func() {
		actions := suite.permissionsRepo.getImpliedActions(schema.ActionEditor)
		suite.ElementsMatch([]schema.PermittedAction{schema.ActionEditor, schema.ActionAdmin}, actions)
	})

	suite.Run("Viewer Implies All Actions", func() {
		actions := suite.permissionsRepo.getImpliedActions(schema.ActionViewer)
		suite.ElementsMatch([]schema.PermittedAction{
			schema.ActionViewer,
			schema.ActionEditor,
			schema.ActionAdmin,
		}, actions)
	})

	suite.Run("Unknown Action Returns Itself", func() {
		unknownAction := schema.PermittedAction("unknown")
		actions := suite.permissionsRepo.getImpliedActions(unknownAction)
		suite.Equal([]schema.PermittedAction{unknownAction}, actions)
	})
}

// Test GetUserPermissionsForResource
func (suite *PermissionsCheckerSuite) TestGetUserPermissionsForResource() {
	suite.Run("User with Specific Permission", func() {
		permissions, err := suite.permissionsRepo.GetUserPermissionsForResource(
			suite.Ctx,
			suite.testUser.ID,
			schema.ResourceTypeTeam,
			suite.testTeam.ID,
		)
		suite.NoError(err)
		suite.Contains(permissions, schema.ActionViewer)
		suite.NotContains(permissions, schema.ActionAdmin)
	})

	suite.Run("User with No Permissions", func() {
		permissions, err := suite.permissionsRepo.GetUserPermissionsForResource(
			suite.Ctx,
			suite.testUser2.ID,
			schema.ResourceTypeTeam,
			suite.testTeam.ID,
		)
		suite.NoError(err)
		suite.Empty(permissions)
	})

	suite.Run("Superuser Has All Permissions", func() {
		// Create a team superuser group since we're testing access to a team resource
		teamSuperuserGroup := suite.DB.Group.Create().
			SetName("Team Superuser for Test").
			SaveX(suite.Ctx)

		teamSuperuserPerm := suite.DB.Permission.Create().
			SetAction(schema.ActionAdmin).
			SetResourceType(schema.ResourceTypeTeam).
			SetResourceSelector(schema.ResourceSelector{Superuser: true}).
			SaveX(suite.Ctx)

		suite.DB.Group.UpdateOneID(teamSuperuserGroup.ID).
			AddPermissionIDs(teamSuperuserPerm.ID).
			ExecX(suite.Ctx)

		// Add user to team superuser group
		suite.DB.User.UpdateOneID(suite.testUser.ID).
			AddGroupIDs(teamSuperuserGroup.ID).
			ExecX(suite.Ctx)

		permissions, err := suite.permissionsRepo.GetUserPermissionsForResource(
			suite.Ctx,
			suite.testUser.ID,
			schema.ResourceTypeTeam,
			suite.testTeam2.ID,
		)
		suite.NoError(err)
		suite.ElementsMatch(permissions, []schema.PermittedAction{
			schema.ActionViewer,
			schema.ActionEditor,
			schema.ActionAdmin,
		})
	})

	suite.Run("Error when DB closed", func() {
		suite.DB.Close()
		permissions, err := suite.permissionsRepo.GetUserPermissionsForResource(
			suite.Ctx,
			suite.testUser.ID,
			schema.ResourceTypeTeam,
			suite.testTeam.ID,
		)
		suite.Error(err)
		suite.Nil(permissions)
		suite.ErrorContains(err, "database is closed")
	})
}

// Test getResourceHierarchy
func (suite *PermissionsCheckerSuite) TestGetResourceHierarchy() {
	suite.Run("Project Hierarchy", func() {
		hierarchy, err := suite.permissionsRepo.getResourceHierarchy(
			suite.Ctx,
			schema.ResourceTypeProject,
			suite.testProject.ID,
		)
		suite.NoError(err)
		suite.Len(hierarchy, 1)
		suite.Equal(schema.ResourceTypeTeam, hierarchy[0].ResourceType)
		suite.Equal(suite.testTeam.ID, hierarchy[0].ResourceID)
	})

	suite.Run("Environment Hierarchy", func() {
		hierarchy, err := suite.permissionsRepo.getResourceHierarchy(
			suite.Ctx,
			schema.ResourceTypeEnvironment,
			suite.testEnv.ID,
		)
		suite.NoError(err)
		suite.Len(hierarchy, 2) // Project and Team

		// Should contain project
		projectFound := false
		teamFound := false
		for _, h := range hierarchy {
			if h.ResourceType == schema.ResourceTypeProject && h.ResourceID == suite.testProject.ID {
				projectFound = true
			}
			if h.ResourceType == schema.ResourceTypeTeam && h.ResourceID == suite.testTeam.ID {
				teamFound = true
			}
		}
		suite.True(projectFound)
		suite.True(teamFound)
	})

	suite.Run("Service Hierarchy", func() {
		hierarchy, err := suite.permissionsRepo.getResourceHierarchy(
			suite.Ctx,
			schema.ResourceTypeService,
			suite.testService.ID,
		)
		suite.NoError(err)
		suite.Len(hierarchy, 3) // Environment, Project, and Team

		envFound := false
		projectFound := false
		teamFound := false
		for _, h := range hierarchy {
			switch h.ResourceType {
			case schema.ResourceTypeEnvironment:
				if h.ResourceID == suite.testEnv.ID {
					envFound = true
				}
			case schema.ResourceTypeProject:
				if h.ResourceID == suite.testProject.ID {
					projectFound = true
				}
			case schema.ResourceTypeTeam:
				if h.ResourceID == suite.testTeam.ID {
					teamFound = true
				}
			}
		}
		suite.True(envFound)
		suite.True(projectFound)
		suite.True(teamFound)
	})

	suite.Run("Team Hierarchy", func() {
		hierarchy, err := suite.permissionsRepo.getResourceHierarchy(
			suite.Ctx,
			schema.ResourceTypeTeam,
			suite.testTeam.ID,
		)
		suite.NoError(err)
		suite.Empty(hierarchy) // Teams have no parent
	})

	suite.Run("Non-existent Resource", func() {
		hierarchy, err := suite.permissionsRepo.getResourceHierarchy(
			suite.Ctx,
			schema.ResourceTypeProject,
			uuid.New(),
		)
		suite.NoError(err)
		suite.Empty(hierarchy) // Should not error, just return empty
	})

	suite.Run("Error when DB closed", func() {
		suite.DB.Close()
		hierarchy, err := suite.permissionsRepo.getResourceHierarchy(
			suite.Ctx,
			schema.ResourceTypeProject,
			suite.testProject.ID,
		)
		suite.Error(err)
		suite.Nil(hierarchy)
		suite.ErrorContains(err, "database is closed")
	})
}

// Test getUserGroupIDs
func (suite *PermissionsCheckerSuite) TestGetUserGroupIDs() {
	suite.Run("User with groups", func() {
		groupIDs, err := suite.permissionsRepo.getUserGroupIDs(suite.Ctx, suite.testUser.ID)
		suite.NoError(err)
		suite.Contains(groupIDs, suite.testGroup.ID)
		suite.Contains(groupIDs, suite.projectEditorGroup.ID)
	})

	suite.Run("User with no groups", func() {
		// Create a user with no groups using the DB directly
		userNoGroups := suite.DB.User.Create().
			SetEmail("nogroups@example.com").
			SetPasswordHash("hashed_password").
			SaveX(suite.Ctx)

		groupIDs, err := suite.permissionsRepo.getUserGroupIDs(suite.Ctx, userNoGroups.ID)
		suite.NoError(err)
		suite.Empty(groupIDs)
	})

	suite.Run("Non-existent user", func() {
		groupIDs, err := suite.permissionsRepo.getUserGroupIDs(suite.Ctx, uuid.New())
		// Should either return an error or empty slice, depending on implementation
		if err != nil {
			suite.Nil(groupIDs)
		} else {
			suite.Empty(groupIDs)
		}
	})
}

// Test CreatePermission
func (suite *PermissionsCheckerSuite) TestCreatePermission() {
	suite.Run("CreatePermission Success", func() {
		selector := schema.ResourceSelector{
			ID: suite.testTeam.ID,
		}

		perm, err := suite.permissionsRepo.CreatePermission(
			suite.Ctx,
			suite.testGroup.ID,
			schema.ActionEditor,
			schema.ResourceTypeTeam,
			selector,
		)

		suite.NoError(err)
		suite.NotNil(perm)
		suite.Equal(schema.ActionEditor, perm.Action)
		suite.Equal(schema.ResourceTypeTeam, perm.ResourceType)
		suite.Equal(selector, perm.ResourceSelector)
	})

	suite.Run("CreatePermission Superuser", func() {
		selector := schema.ResourceSelector{
			Superuser: true,
		}

		perm, err := suite.permissionsRepo.CreatePermission(
			suite.Ctx,
			suite.testGroup.ID,
			schema.ActionAdmin,
			schema.ResourceTypeSystem,
			selector,
		)

		suite.NoError(err)
		suite.NotNil(perm)
		suite.True(perm.ResourceSelector.Superuser)
	})

	suite.Run("CreatePermission Error when DB closed", func() {
		suite.DB.Close()
		selector := schema.ResourceSelector{ID: suite.testTeam.ID}

		perm, err := suite.permissionsRepo.CreatePermission(
			suite.Ctx,
			suite.testGroup.ID,
			schema.ActionEditor,
			schema.ResourceTypeTeam,
			selector,
		)

		suite.Error(err)
		suite.Nil(perm)
		suite.ErrorContains(err, "database is closed")
	})
}

// Test DeletePermission
func (suite *PermissionsCheckerSuite) TestDeletePermission() {
	suite.Run("DeletePermission Success", func() {
		// Create a permission to delete
		selector := schema.ResourceSelector{ID: suite.testTeam.ID}
		perm, err := suite.permissionsRepo.CreatePermission(
			suite.Ctx,
			suite.testGroup.ID,
			schema.ActionEditor,
			schema.ResourceTypeTeam,
			selector,
		)
		suite.NoError(err)

		// Delete it
		err = suite.permissionsRepo.DeletePermission(suite.Ctx, perm.ID)
		suite.NoError(err)

		// Verify it's gone
		_, err = suite.DB.Permission.Get(suite.Ctx, perm.ID)
		suite.Error(err)
	})

	suite.Run("DeletePermission Non-existent", func() {
		err := suite.permissionsRepo.DeletePermission(suite.Ctx, uuid.New())
		suite.Error(err) // Should error when trying to delete non-existent permission
	})

	suite.Run("DeletePermission Error when DB closed", func() {
		suite.DB.Close()
		err := suite.permissionsRepo.DeletePermission(suite.Ctx, uuid.New())
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

// Test GetPermissionsByGroup
func (suite *PermissionsCheckerSuite) TestGetPermissionsByGroup() {
	suite.Run("GetPermissionsByGroup Success", func() {
		permissions, err := suite.permissionsRepo.GetPermissionsByGroup(suite.Ctx, suite.testGroup.ID)
		suite.NoError(err)
		suite.NotEmpty(permissions)

		// Should contain the team viewer permission we created in setup
		found := false
		for _, p := range permissions {
			if p.Action == schema.ActionViewer &&
				p.ResourceType == schema.ResourceTypeTeam &&
				p.ResourceSelector.ID == suite.testTeam.ID {
				found = true
				break
			}
		}
		suite.True(found)
	})

	suite.Run("GetPermissionsByGroup Empty", func() {
		permissions, err := suite.permissionsRepo.GetPermissionsByGroup(suite.Ctx, suite.testGroupNoPerms.ID)
		suite.NoError(err)
		suite.Empty(permissions)
	})

	suite.Run("GetPermissionsByGroup Non-existent Group", func() {
		permissions, err := suite.permissionsRepo.GetPermissionsByGroup(suite.Ctx, uuid.New())
		suite.NoError(err)
		suite.Empty(permissions)
	})

	suite.Run("GetPermissionsByGroup Error when DB closed", func() {
		suite.DB.Close()
		permissions, err := suite.permissionsRepo.GetPermissionsByGroup(suite.Ctx, suite.testGroup.ID)
		suite.Error(err)
		suite.Nil(permissions)
		suite.ErrorContains(err, "database is closed")
	})
}

// Test GetPotentialParents
func (suite *PermissionsCheckerSuite) TestGetPotentialParents() {
	suite.Run("Service Parents", func() {
		parents := GetPotentialParents(schema.ResourceTypeService)
		expected := []schema.ResourceType{
			schema.ResourceTypeEnvironment,
			schema.ResourceTypeProject,
			schema.ResourceTypeTeam,
		}
		suite.ElementsMatch(expected, parents)
	})

	suite.Run("Environment Parents", func() {
		parents := GetPotentialParents(schema.ResourceTypeEnvironment)
		expected := []schema.ResourceType{
			schema.ResourceTypeProject,
			schema.ResourceTypeTeam,
		}
		suite.ElementsMatch(expected, parents)
	})

	suite.Run("Project Parents", func() {
		parents := GetPotentialParents(schema.ResourceTypeProject)
		expected := []schema.ResourceType{schema.ResourceTypeTeam}
		suite.ElementsMatch(expected, parents)
	})

	suite.Run("Team Parents", func() {
		parents := GetPotentialParents(schema.ResourceTypeTeam)
		suite.Empty(parents)
	})

	suite.Run("Unknown Resource Type", func() {
		unknownType := schema.ResourceType("unknown")
		parents := GetPotentialParents(unknownType)
		suite.Empty(parents)
	})
}

// Test permission with nil resource ID
func (suite *PermissionsCheckerSuite) TestNilResourceID() {
	suite.Run("Check with Nil Resource ID", func() {
		checks := []PermissionCheck{
			{
				Action:       schema.ActionViewer,
				ResourceType: schema.ResourceTypeTeam,
				ResourceID:   uuid.Nil, // Should be handled gracefully
			},
		}

		err := suite.permissionsRepo.Check(suite.Ctx, suite.testUser.ID, checks)
		suite.Error(err) // Should fail since nil UUID won't match any specific resource
		suite.Equal(errdefs.ErrUnauthorized, err)
	})
}

// Test edge cases
func (suite *PermissionsCheckerSuite) TestEdgeCases() {
	suite.Run("Multiple Permission Checks - One Pass", func() {
		checks := []PermissionCheck{
			{
				Action:       schema.ActionViewer,
				ResourceType: schema.ResourceTypeTeam,
				ResourceID:   suite.testTeam2.ID, // No permission
			},
			{
				Action:       schema.ActionViewer,
				ResourceType: schema.ResourceTypeTeam,
				ResourceID:   suite.testTeam.ID, // Has permission
			},
		}

		err := suite.permissionsRepo.Check(suite.Ctx, suite.testUser.ID, checks)
		suite.NoError(err) // Should pass because one check succeeds
	})

	suite.Run("Multiple Permission Checks - All Fail", func() {
		checks := []PermissionCheck{
			{
				Action:       schema.ActionViewer,
				ResourceType: schema.ResourceTypeTeam,
				ResourceID:   suite.testTeam2.ID, // No permission
			},
			{
				Action:       schema.ActionAdmin,
				ResourceType: schema.ResourceTypeTeam,
				ResourceID:   suite.testTeam2.ID, // No permission
			},
		}

		err := suite.permissionsRepo.Check(suite.Ctx, suite.testUser.ID, checks)
		suite.Error(err)
		suite.Equal(errdefs.ErrUnauthorized, err)
	})
}

func TestPermissionsCheckerSuite(t *testing.T) {
	suite.Run(t, new(PermissionsCheckerSuite))
}
