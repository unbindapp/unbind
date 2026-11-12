package team_repo

import (
	"testing"

	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/group"
	"github.com/unbindapp/unbind-api/ent/permission"
	"github.com/unbindapp/unbind-api/ent/schema"
	repository "github.com/unbindapp/unbind-api/internal/repositories/repositorytest"
)

type RoleGroupsSuite struct {
	repository.RepositoryBaseSuite
	teamRepo *TeamRepository
	team     *ent.Team
	other    *ent.Team
	user     *ent.User
}

func (suite *RoleGroupsSuite) SetupTest() {
	suite.RepositoryBaseSuite.SetupTest()
	suite.teamRepo = NewTeamRepository(suite.DB)
	suite.team = suite.DB.Team.Create().SetKubernetesName("acme-abc").SetName("Acme").SetNamespace("acme-abc").SetKubernetesSecret("acme-abc").SaveX(suite.Ctx)
	suite.other = suite.DB.Team.Create().SetKubernetesName("beta-abc").SetName("Beta").SetNamespace("beta-abc").SetKubernetesSecret("beta-abc").SaveX(suite.Ctx)
	suite.user = suite.DB.User.Create().SetEmail("dev@example.com").SetPasswordHash("x").SaveX(suite.Ctx)
}

func (suite *RoleGroupsSuite) TearDownTest() {
	suite.RepositoryBaseSuite.TearDownTest()
}

func (suite *RoleGroupsSuite) grantGroup(name string, selector schema.ResourceSelector, action schema.PermittedAction) *ent.Group {
	perm := suite.DB.Permission.Create().SetAction(action).SetResourceType(schema.ResourceTypeTeam).SetResourceSelector(selector).SaveX(suite.Ctx)
	return suite.DB.Group.Create().SetName(name).AddPermissions(perm).AddUsers(suite.user).SaveX(suite.Ctx)
}

func (suite *RoleGroupsSuite) TestEnsureRoleGroupsIsIdempotentAndScoped() {
	first, err := suite.teamRepo.EnsureRoleGroups(suite.Ctx, nil, suite.team)
	suite.Require().NoError(err)
	again, err := suite.teamRepo.EnsureRoleGroups(suite.Ctx, nil, suite.team)
	suite.Require().NoError(err)

	suite.Len(first, 3)
	suite.Len(again, 3)
	suite.Equal(3, suite.DB.Group.Query().Where(group.TeamID(suite.team.ID)).CountX(suite.Ctx))

	for i, role := range MemberRoles {
		suite.Equal(first[i].ID, again[i].ID)
		suite.Equal(role, *first[i].Role)
		suite.Equal("team-acme-abc-"+string(role), first[i].Name)
		perms := suite.DB.Group.QueryPermissions(first[i]).AllX(suite.Ctx)
		suite.Require().Len(perms, 1)
		suite.Equal(role, perms[0].Action)
		suite.Equal(schema.ResourceSelector{ID: suite.team.ID}, perms[0].ResourceSelector)
	}
}

func (suite *RoleGroupsSuite) TestGetGroupsReachingTeamSkipsOwnRoleGroupsAndOtherTeams() {
	_, err := suite.teamRepo.EnsureRoleGroups(suite.Ctx, nil, suite.team)
	suite.Require().NoError(err)
	superusers := suite.grantGroup("superuser", schema.ResourceSelector{Superuser: true}, schema.ActionAdmin)
	direct := suite.grantGroup("acme-viewers", schema.ResourceSelector{ID: suite.team.ID}, schema.ActionViewer)
	suite.grantGroup("beta-admins", schema.ResourceSelector{ID: suite.other.ID}, schema.ActionAdmin)

	reaching, err := suite.teamRepo.GetGroupsReachingTeam(suite.Ctx, suite.team.ID)
	suite.Require().NoError(err)

	var names []string
	for _, g := range reaching {
		names = append(names, g.Name)
		suite.Len(g.Edges.Users, 1)
	}
	suite.ElementsMatch([]string{superusers.Name, direct.Name}, names)
}

func (suite *RoleGroupsSuite) TestDeleteRemovesRoleGroupsAndGrantsNamingTheTeam() {
	_, err := suite.teamRepo.EnsureRoleGroups(suite.Ctx, nil, suite.team)
	suite.Require().NoError(err)
	suite.grantGroup("acme-viewers", schema.ResourceSelector{ID: suite.team.ID}, schema.ActionViewer)
	suite.grantGroup("superuser", schema.ResourceSelector{Superuser: true}, schema.ActionAdmin)
	suite.grantGroup("beta-admins", schema.ResourceSelector{ID: suite.other.ID}, schema.ActionAdmin)

	suite.Require().NoError(suite.teamRepo.Delete(suite.Ctx, nil, suite.team.ID))

	suite.Equal(0, suite.DB.Group.Query().Where(group.TeamID(suite.team.ID)).CountX(suite.Ctx))
	suite.Equal(3, suite.DB.Group.Query().CountX(suite.Ctx))
	remaining := suite.DB.Permission.Query().Where(permission.ResourceTypeEQ(schema.ResourceTypeTeam)).AllX(suite.Ctx)
	suite.Len(remaining, 2)
	for _, p := range remaining {
		suite.NotEqual(suite.team.ID, p.ResourceSelector.ID)
	}
}

func (suite *RoleGroupsSuite) project(name string) *ent.Project {
	return suite.DB.Project.Create().SetTeamID(suite.team.ID).SetKubernetesName(name).SetName(name).SetKubernetesSecret(name).SaveX(suite.Ctx)
}

func (suite *RoleGroupsSuite) TestEnsureProjectRoleGroupsIsIdempotentAndGrantsOnlyTheProject() {
	web := suite.project("web-abc")
	_, err := suite.teamRepo.EnsureRoleGroups(suite.Ctx, nil, suite.team)
	suite.Require().NoError(err)

	first, err := suite.teamRepo.EnsureProjectRoleGroups(suite.Ctx, nil, web)
	suite.Require().NoError(err)
	suite.DB.Group.UpdateOne(first[1]).AddUsers(suite.user).ExecX(suite.Ctx)
	again, err := suite.teamRepo.EnsureProjectRoleGroups(suite.Ctx, nil, web)
	suite.Require().NoError(err)

	suite.Len(first, 3)
	suite.Len(again, 3)
	suite.Equal(3, suite.DB.Group.Query().Where(group.ProjectID(web.ID)).CountX(suite.Ctx))
	suite.Require().Len(again[1].Edges.Users, 1, "members come back loaded")

	for i, role := range MemberRoles {
		suite.Equal(first[i].ID, again[i].ID)
		suite.Equal(role, *first[i].Role)
		suite.Nil(first[i].TeamID)
		suite.Equal("project-web-abc-"+string(role), first[i].Name)
		perms := suite.DB.Group.QueryPermissions(first[i]).AllX(suite.Ctx)
		suite.Require().Len(perms, 1)
		suite.Equal(role, perms[0].Action)
		suite.Equal(schema.ResourceTypeProject, perms[0].ResourceType)
		suite.Equal(schema.ResourceSelector{ID: web.ID}, perms[0].ResourceSelector)
	}

	teamGroups, err := suite.teamRepo.GetRoleGroups(suite.Ctx, suite.team.ID)
	suite.Require().NoError(err)
	suite.Len(teamGroups, 3, "project role groups are not the team's")

	projectGroups, err := suite.teamRepo.GetProjectRoleGroups(suite.Ctx, web.ID)
	suite.Require().NoError(err)
	suite.Len(projectGroups, 3)
}

func (suite *RoleGroupsSuite) TestGetGroupsReachingProjectHoldsTeamAccessAndSkipsOwnAndSiblingProjects() {
	web, api := suite.project("web-abc"), suite.project("api-abc")
	teamGroups, err := suite.teamRepo.EnsureRoleGroups(suite.Ctx, nil, suite.team)
	suite.Require().NoError(err)
	_, err = suite.teamRepo.EnsureProjectRoleGroups(suite.Ctx, nil, web)
	suite.Require().NoError(err)
	_, err = suite.teamRepo.EnsureProjectRoleGroups(suite.Ctx, nil, api)
	suite.Require().NoError(err)
	superusers := suite.grantGroup("superuser", schema.ResourceSelector{Superuser: true}, schema.ActionAdmin)
	suite.grantGroup("beta-admins", schema.ResourceSelector{ID: suite.other.ID}, schema.ActionAdmin)
	webGrant := suite.DB.Permission.Create().SetAction(schema.ActionViewer).SetResourceType(schema.ResourceTypeProject).SetResourceSelector(schema.ResourceSelector{ID: web.ID}).SaveX(suite.Ctx)
	webViewers := suite.DB.Group.Create().SetName("web-viewers").AddPermissions(webGrant).SaveX(suite.Ctx)

	reaching, err := suite.teamRepo.GetGroupsReachingProject(suite.Ctx, suite.team.ID, web.ID)
	suite.Require().NoError(err)

	var names []string
	for _, g := range reaching {
		names = append(names, g.Name)
	}
	suite.ElementsMatch([]string{superusers.Name, webViewers.Name, teamGroups[0].Name, teamGroups[1].Name, teamGroups[2].Name}, names)
}

func TestRoleGroupsSuite(t *testing.T) {
	suite.Run(t, new(RoleGroupsSuite))
}
