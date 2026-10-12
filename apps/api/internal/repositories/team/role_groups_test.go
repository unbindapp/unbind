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

func TestRoleGroupsSuite(t *testing.T) {
	suite.Run(t, new(RoleGroupsSuite))
}
