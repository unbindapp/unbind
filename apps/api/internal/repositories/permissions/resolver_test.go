package permissions_repo

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	deployment_repo "github.com/unbindapp/unbind-api/internal/repositories/deployment"
	environment_repo "github.com/unbindapp/unbind-api/internal/repositories/environment"
	project_repo "github.com/unbindapp/unbind-api/internal/repositories/project"
	repository "github.com/unbindapp/unbind-api/internal/repositories/repositorytest"
	service_repo "github.com/unbindapp/unbind-api/internal/repositories/service"
	team_repo "github.com/unbindapp/unbind-api/internal/repositories/team"
	user_repo "github.com/unbindapp/unbind-api/internal/repositories/user"
	"golang.org/x/crypto/bcrypt"
)

type ResolverSuite struct {
	repository.RepositoryBaseSuite
	permissionsRepo *PermissionsRepository

	teamUser      *ent.User
	projectAdmin  *ent.User
	superuserUser *ent.User
	systemUser    *ent.User
	groupless     *ent.User

	team    *ent.Team
	team2   *ent.Team
	project *ent.Project
	env     *ent.Environment
	service *ent.Service
}

func (suite *ResolverSuite) SetupTest() {
	suite.RepositoryBaseSuite.SetupTest()

	userRepo := user_repo.NewUserRepository(suite.DB)
	projectRepo := project_repo.NewProjectRepository(suite.DB)
	environmentRepo := environment_repo.NewEnvironmentRepository(suite.DB)
	deploymentRepo := deployment_repo.NewDeploymentRepository(suite.DB)
	serviceRepo := service_repo.NewServiceRepository(suite.DB, deploymentRepo)
	teamRepo := team_repo.NewTeamRepository(suite.DB)
	suite.permissionsRepo = NewPermissionsRepository(
		suite.DB,
		userRepo,
		projectRepo,
		environmentRepo,
		serviceRepo,
		teamRepo,
	)

	pwd, _ := bcrypt.GenerateFromPassword([]byte("test-password"), 1)
	suite.teamUser = suite.DB.User.Create().SetEmail("team@example.com").SetPasswordHash(string(pwd)).SaveX(suite.Ctx)
	suite.projectAdmin = suite.DB.User.Create().SetEmail("project@example.com").SetPasswordHash(string(pwd)).SaveX(suite.Ctx)
	suite.superuserUser = suite.DB.User.Create().SetEmail("super@example.com").SetPasswordHash(string(pwd)).SaveX(suite.Ctx)
	suite.systemUser = suite.DB.User.Create().SetEmail("system@example.com").SetPasswordHash(string(pwd)).SaveX(suite.Ctx)
	suite.groupless = suite.DB.User.Create().SetEmail("none@example.com").SetPasswordHash(string(pwd)).SaveX(suite.Ctx)

	suite.team = suite.DB.Team.Create().
		SetName("Team").SetKubernetesName("team").SetNamespace("team-ns").SetKubernetesSecret("team-secret").
		SaveX(suite.Ctx)
	suite.team2 = suite.DB.Team.Create().
		SetName("Team 2").SetKubernetesName("team-2").SetNamespace("team-2-ns").SetKubernetesSecret("team-2-secret").
		SaveX(suite.Ctx)
	suite.project = suite.DB.Project.Create().
		SetName("Project").SetKubernetesName("project").SetKubernetesSecret("project-secret").SetTeamID(suite.team.ID).
		SaveX(suite.Ctx)
	suite.env = suite.DB.Environment.Create().
		SetName("Env").SetKubernetesName("env").SetKubernetesSecret("env-secret").SetProjectID(suite.project.ID).
		SaveX(suite.Ctx)
	suite.service = suite.DB.Service.Create().
		SetName("Service").SetKubernetesName("service").SetType(schema.ServiceTypeDockerimage).
		SetEnvironmentID(suite.env.ID).SetKubernetesSecret("service-secret").
		SaveX(suite.Ctx)

	suite.addUserWithPermission(suite.teamUser, schema.ActionViewer, schema.ResourceTypeTeam, schema.ResourceSelector{ID: suite.team.ID})
	suite.addUserWithPermission(suite.projectAdmin, schema.ActionAdmin, schema.ResourceTypeProject, schema.ResourceSelector{ID: suite.project.ID})
	suite.addUserWithPermission(suite.superuserUser, schema.ActionEditor, schema.ResourceTypeTeam, schema.ResourceSelector{Superuser: true})
	suite.addUserWithPermission(suite.systemUser, schema.ActionAdmin, schema.ResourceTypeSystem, schema.ResourceSelector{Superuser: true})
}

func (suite *ResolverSuite) addUserWithPermission(user *ent.User, action schema.PermittedAction, resourceType schema.ResourceType, selector schema.ResourceSelector) {
	grp := suite.DB.Group.Create().SetName(user.Email + "-group").SaveX(suite.Ctx)
	perm := suite.DB.Permission.Create().
		SetAction(action).
		SetResourceType(resourceType).
		SetResourceSelector(selector).
		SaveX(suite.Ctx)
	suite.DB.Group.UpdateOneID(grp.ID).AddPermissionIDs(perm.ID).ExecX(suite.Ctx)
	suite.DB.User.UpdateOneID(user.ID).AddGroupIDs(grp.ID).ExecX(suite.Ctx)
}

func (suite *ResolverSuite) TearDownTest() {
	suite.RepositoryBaseSuite.TearDownTest()
	suite.permissionsRepo = nil
}

func (suite *ResolverSuite) TestDirectGrantAndImplication() {
	set, err := suite.permissionsRepo.GetUserPermissionSet(suite.Ctx, suite.projectAdmin.ID)
	suite.NoError(err)

	suite.Equal([]schema.PermittedAction{schema.ActionAdmin, schema.ActionEditor, schema.ActionViewer},
		set.ProjectActions(suite.team.ID, suite.project.ID))
	suite.Empty(set.TeamActions(suite.team.ID))
}

func (suite *ResolverSuite) TestHierarchyGrant() {
	set, err := suite.permissionsRepo.GetUserPermissionSet(suite.Ctx, suite.teamUser.ID)
	suite.NoError(err)

	expected := []schema.PermittedAction{schema.ActionViewer}
	suite.Equal(expected, set.TeamActions(suite.team.ID))
	suite.Equal(expected, set.ProjectActions(suite.team.ID, suite.project.ID))
	suite.Equal(expected, set.EnvironmentActions(suite.team.ID, suite.project.ID, suite.env.ID))
	suite.Equal(expected, set.ServiceActions(suite.team.ID, suite.project.ID, suite.env.ID, suite.service.ID))
	suite.Empty(set.TeamActions(suite.team2.ID))
}

func (suite *ResolverSuite) TestSuperuserPerType() {
	set, err := suite.permissionsRepo.GetUserPermissionSet(suite.Ctx, suite.superuserUser.ID)
	suite.NoError(err)

	expected := []schema.PermittedAction{schema.ActionEditor, schema.ActionViewer}
	suite.Equal(expected, set.TeamActions(suite.team.ID))
	suite.Equal(expected, set.TeamActions(suite.team2.ID))
	suite.Equal(expected, set.ProjectActions(suite.team.ID, suite.project.ID))
}

func (suite *ResolverSuite) TestSystemSuperuserDoesNotGrantResources() {
	set, err := suite.permissionsRepo.GetUserPermissionSet(suite.Ctx, suite.systemUser.ID)
	suite.NoError(err)

	suite.Empty(set.TeamActions(suite.team.ID))
	suite.Empty(set.ProjectActions(suite.team.ID, suite.project.ID))
	suite.Equal([]schema.PermittedAction{schema.ActionAdmin, schema.ActionEditor, schema.ActionViewer},
		set.AllowedActions(ResourceRef{Type: schema.ResourceTypeSystem, ID: uuid.Nil}))
}

func (suite *ResolverSuite) TestNoGroups() {
	set, err := suite.permissionsRepo.GetUserPermissionSet(suite.Ctx, suite.groupless.ID)
	suite.NoError(err)

	actions := set.TeamActions(suite.team.ID)
	suite.NotNil(actions)
	suite.Empty(actions)
}

// TestParityWithCheck asserts the snapshot agrees with the authoritative checker.
func (suite *ResolverSuite) TestParityWithCheck() {
	users := []*ent.User{suite.teamUser, suite.projectAdmin, suite.superuserUser, suite.systemUser, suite.groupless}
	refs := []struct {
		resourceType schema.ResourceType
		resourceID   uuid.UUID
		actions      func(set *UserPermissionSet) []schema.PermittedAction
	}{
		{schema.ResourceTypeTeam, suite.team.ID, func(s *UserPermissionSet) []schema.PermittedAction { return s.TeamActions(suite.team.ID) }},
		{schema.ResourceTypeTeam, suite.team2.ID, func(s *UserPermissionSet) []schema.PermittedAction { return s.TeamActions(suite.team2.ID) }},
		{schema.ResourceTypeProject, suite.project.ID, func(s *UserPermissionSet) []schema.PermittedAction {
			return s.ProjectActions(suite.team.ID, suite.project.ID)
		}},
		{schema.ResourceTypeEnvironment, suite.env.ID, func(s *UserPermissionSet) []schema.PermittedAction {
			return s.EnvironmentActions(suite.team.ID, suite.project.ID, suite.env.ID)
		}},
		{schema.ResourceTypeService, suite.service.ID, func(s *UserPermissionSet) []schema.PermittedAction {
			return s.ServiceActions(suite.team.ID, suite.project.ID, suite.env.ID, suite.service.ID)
		}},
	}

	for _, user := range users {
		set, err := suite.permissionsRepo.GetUserPermissionSet(suite.Ctx, user.ID)
		suite.NoError(err)

		for _, ref := range refs {
			resolved := ref.actions(set)
			for _, action := range []schema.PermittedAction{schema.ActionAdmin, schema.ActionEditor, schema.ActionViewer} {
				checkErr := suite.permissionsRepo.Check(suite.Ctx, user.ID, []PermissionCheck{
					{Action: action, ResourceType: ref.resourceType, ResourceID: ref.resourceID},
				})
				if contains(resolved, action) {
					suite.NoError(checkErr, "user %s action %s on %s %s", user.Email, action, ref.resourceType, ref.resourceID)
				} else {
					suite.Error(checkErr, "user %s action %s on %s %s", user.Email, action, ref.resourceType, ref.resourceID)
				}
			}
		}
	}
}

func (suite *ResolverSuite) TestSystemCallerBypassesCheck() {
	ctx := WithSystemCaller(suite.Ctx)
	err := suite.permissionsRepo.Check(ctx, suite.groupless.ID, []PermissionCheck{
		{Action: schema.ActionAdmin, ResourceType: schema.ResourceTypeSystem},
	})
	suite.NoError(err)

	err = suite.permissionsRepo.Check(suite.Ctx, suite.groupless.ID, []PermissionCheck{
		{Action: schema.ActionAdmin, ResourceType: schema.ResourceTypeSystem},
	})
	suite.Error(err)
}

func TestResolverSuite(t *testing.T) {
	suite.Run(t, new(ResolverSuite))
}
