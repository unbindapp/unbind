package github_handler

import (
	"context"
	"net/http"
	"net/url"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/danielgtaylor/huma/v2"
	"github.com/google/go-github/v69/github"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/config"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/githubapp"
	"github.com/unbindapp/unbind-api/ent/githubinstallation"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/api/apictx"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/infrastructure/cache"
	github_integration "github.com/unbindapp/unbind-api/internal/integrations/github"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
	"github.com/unbindapp/unbind-api/internal/repositories/repositories"
	repository "github.com/unbindapp/unbind-api/internal/repositories/repositorytest"
	mocks_integrations_github "github.com/unbindapp/unbind-api/mocks/integrations/github"
)

type GithubHandlerSuite struct {
	repository.RepositoryBaseSuite
	handlers     *HandlerGroup
	githubClient *mocks_integrations_github.GithubClientMock
	redis        *miniredis.Miniredis
	team         *ent.Team
	otherTeam    *ent.Team
	creator      *ent.User
	teamViewer   *ent.User
	teamEditor   *ent.User
	outsider     *ent.User
	admin        *ent.User
	app          *ent.GithubApp
	installation *ent.GithubInstallation
}

func (suite *GithubHandlerSuite) SetupTest() {
	suite.RepositoryBaseSuite.SetupTest()
	suite.githubClient = mocks_integrations_github.NewGithubClientMock(suite.T())
	suite.redis = miniredis.RunT(suite.T())
	suite.handlers = &HandlerGroup{srv: &server.Server{
		Cfg:          &config.Config{GithubURL: "https://github.com"},
		Repository:   repositories.NewRepositories(suite.DB),
		GithubClient: suite.githubClient,
		StringCache:  cache.NewStringCache(redis.NewClient(&redis.Options{Addr: suite.redis.Addr()}), "test"),
	}}

	suite.team = suite.createTeam("team")
	suite.otherTeam = suite.createTeam("other")

	suite.creator = suite.userWithGrant("creator@example.com", schema.ActionEditor, suite.team.ID)
	suite.teamViewer = suite.userWithGrant("viewer@example.com", schema.ActionViewer, suite.team.ID)
	suite.teamEditor = suite.userWithGrant("editor@example.com", schema.ActionEditor, suite.team.ID)
	suite.outsider = suite.userWithGrant("outsider@example.com", schema.ActionEditor, suite.otherTeam.ID)
	suite.admin = suite.systemAdmin("admin@example.com")

	suite.app = suite.DB.GithubApp.Create().
		SetID(12345).
		SetUUID(uuid.New()).
		SetClientID("client-id").
		SetClientSecret("client-secret").
		SetWebhookSecret("webhook-secret").
		SetPrivateKey("private-key").
		SetName("Test App").
		SetSlug("test-app").
		SetCreatedBy(suite.creator.ID).
		SaveX(suite.Ctx)

	suite.installation = suite.DB.GithubInstallation.Create().
		SetID(67890).
		SetGithubAppID(suite.app.ID).
		SetAccountID(11111).
		SetAccountLogin("test-org").
		SetAccountType(githubinstallation.AccountTypeOrganization).
		SetAccountURL("https://github.com/test-org").
		SaveX(suite.Ctx)
}

func (suite *GithubHandlerSuite) createTeam(name string) *ent.Team {
	return suite.DB.Team.Create().
		SetKubernetesName(name).
		SetName(name).
		SetNamespace(name).
		SetKubernetesSecret(name + "-secret").
		SaveX(suite.Ctx)
}

func (suite *GithubHandlerSuite) userWithGrant(email string, action schema.PermittedAction, teamID uuid.UUID) *ent.User {
	perm := suite.DB.Permission.Create().
		SetAction(action).
		SetResourceType(schema.ResourceTypeTeam).
		SetResourceSelector(schema.ResourceSelector{ID: teamID}).
		SaveX(suite.Ctx)
	group := suite.DB.Group.Create().SetName(email).AddPermissionIDs(perm.ID).SaveX(suite.Ctx)
	return suite.DB.User.Create().SetEmail(email).SetPasswordHash("x").AddGroupIDs(group.ID).SaveX(suite.Ctx)
}

// systemAdmin is a member of the superuser group, admin of the system and of every team
func (suite *GithubHandlerSuite) systemAdmin(email string) *ent.User {
	group := suite.DB.Group.Create().SetName(email).SaveX(suite.Ctx)
	for _, resourceType := range []schema.ResourceType{schema.ResourceTypeSystem, schema.ResourceTypeTeam} {
		perm := suite.DB.Permission.Create().
			SetAction(schema.ActionAdmin).
			SetResourceType(resourceType).
			SetResourceSelector(schema.ResourceSelector{Superuser: true}).
			SaveX(suite.Ctx)
		group.Update().AddPermissionIDs(perm.ID).ExecX(suite.Ctx)
	}
	return suite.DB.User.Create().SetEmail(email).SetPasswordHash("x").AddGroupIDs(group.ID).SaveX(suite.Ctx)
}

func (suite *GithubHandlerSuite) createService(name string, teamID uuid.UUID, installationID int64) *ent.Service {
	project := suite.DB.Project.Create().
		SetKubernetesName(name).
		SetName(name).
		SetTeamID(teamID).
		SetKubernetesSecret(name + "-secret").
		SaveX(suite.Ctx)
	env := suite.DB.Environment.Create().
		SetKubernetesName(name).
		SetName(name).
		SetProjectID(project.ID).
		SetKubernetesSecret(name + "-env-secret").
		SaveX(suite.Ctx)
	return suite.DB.Service.Create().
		SetType(schema.ServiceTypeGithub).
		SetKubernetesName(name).
		SetName(name).
		SetEnvironmentID(env.ID).
		SetKubernetesSecret(name + "-service-secret").
		SetGithubInstallationID(installationID).
		SetGitRepository("repo").
		SetGitRepositoryOwner("test-org").
		SaveX(suite.Ctx)
}

func (suite *GithubHandlerSuite) shareWithTeam(teamID uuid.UUID) {
	suite.DB.GithubApp.UpdateOneID(suite.app.ID).AddTeamIDs(teamID).ExecX(suite.Ctx)
}

func (suite *GithubHandlerSuite) as(user *ent.User) context.Context {
	return context.WithValue(suite.Ctx, apictx.UserKey, user)
}

func (suite *GithubHandlerSuite) assertStatus(err error, status int) {
	var statusErr huma.StatusError
	suite.Require().ErrorAs(err, &statusErr)
	suite.Equal(status, statusErr.GetStatus())
}

func (suite *GithubHandlerSuite) listApps(user *ent.User, input *GithubAppListInput) []*GithubAppAPIResponse {
	resp, err := suite.handlers.HandleListGithubApps(suite.as(user), input)
	suite.Require().NoError(err)
	return resp.Body.Data
}

func (suite *GithubHandlerSuite) TestPrivateAppVisibleOnlyToCreator() {
	apps := suite.listApps(suite.creator, &GithubAppListInput{})
	suite.Require().Len(apps, 1)
	suite.Equal(suite.creator.ID, *apps[0].CreatedBy)
	suite.Equal("creator@example.com", *apps[0].CreatedByEmail)
	suite.Empty(apps[0].Teams)
	suite.Len(apps[0].Installations, 1)

	suite.Empty(suite.listApps(suite.teamEditor, &GithubAppListInput{}))

	_, err := suite.handlers.HandleGetGithubApp(suite.as(suite.teamEditor), &GithubAppGetInput{UUID: suite.app.UUID})
	suite.assertStatus(err, 404)

	installations, err := suite.listInstallations(suite.as(suite.teamEditor), suite.team.ID)
	suite.Require().NoError(err)
	suite.Empty(installations)

	_, err = suite.repositoryDetail(suite.as(suite.teamEditor), suite.team.ID)
	suite.assertStatus(err, 404)
}

func (suite *GithubHandlerSuite) TestSharedAppVisibleToTeam() {
	suite.shareWithTeam(suite.team.ID)

	apps := suite.listApps(suite.teamViewer, &GithubAppListInput{})
	suite.Require().Len(apps, 1)
	suite.Equal([]*GithubAppTeamAPIResponse{{ID: suite.team.ID, Name: "team"}}, apps[0].Teams)

	suite.Len(suite.listApps(suite.teamViewer, &GithubAppListInput{TeamID: suite.team.ID}), 1)
	suite.Empty(suite.listApps(suite.teamViewer, &GithubAppListInput{Owned: true}))
	suite.Empty(suite.listApps(suite.outsider, &GithubAppListInput{}))

	_, err := suite.handlers.HandleListGithubApps(suite.as(suite.outsider), &GithubAppListInput{TeamID: suite.team.ID})
	suite.assertStatus(err, 403)

	installations, err := suite.listInstallations(suite.as(suite.teamViewer), suite.team.ID)
	suite.Require().NoError(err)
	suite.Len(installations, 1)
}

func (suite *GithubHandlerSuite) TestServiceCountsFollowTheTeamFilter() {
	suite.shareWithTeam(suite.team.ID)
	suite.createService("in-team", suite.team.ID, suite.installation.ID)
	suite.createService("elsewhere", suite.otherTeam.ID, suite.installation.ID)

	apps := suite.listApps(suite.creator, &GithubAppListInput{})
	suite.Equal(2, apps[0].Installations[0].ServiceCount)

	apps = suite.listApps(suite.creator, &GithubAppListInput{TeamID: suite.team.ID})
	suite.Equal(1, apps[0].Installations[0].ServiceCount)
}

func (suite *GithubHandlerSuite) TestSharedWithSeveralTeams() {
	suite.shareWithTeam(suite.team.ID)
	suite.shareWithTeam(suite.otherTeam.ID)

	teamNames := func(user *ent.User) []string {
		apps := suite.listApps(user, &GithubAppListInput{})
		suite.Require().Len(apps, 1)
		names := []string{}
		for _, team := range apps[0].Teams {
			names = append(names, team.Name)
		}
		return names
	}
	suite.Equal([]string{"other", "team"}, teamNames(suite.creator))
	suite.Equal([]string{"team"}, teamNames(suite.teamViewer), "other teams' names stay hidden")
	suite.Equal([]string{"other"}, teamNames(suite.outsider))
	suite.Len(suite.listApps(suite.outsider, &GithubAppListInput{TeamID: suite.otherTeam.ID}), 1)
}

func (suite *GithubHandlerSuite) listInstallations(ctx context.Context, teamID uuid.UUID) ([]*GithubInstallationAPIResponse, error) {
	resp, err := suite.handlers.HandleListGithubAppInstallations(ctx, &GithubInstallationListInput{TeamID: teamID})
	if err != nil {
		return nil, err
	}
	return resp.Body.Data, nil
}

func (suite *GithubHandlerSuite) repositoryDetail(ctx context.Context, teamID uuid.UUID) (*GithubRepositoryDetailResponse, error) {
	return suite.handlers.HandleGetGithubRepositoryDetail(ctx, &GithubRepositoryDetailInput{TeamID: teamID, InstallationID: suite.installation.ID, Owner: "test-org", RepoName: "repo"})
}

func (suite *GithubHandlerSuite) grant(user *ent.User, action schema.PermittedAction, teamID uuid.UUID) {
	perm := suite.DB.Permission.Create().
		SetAction(action).
		SetResourceType(schema.ResourceTypeTeam).
		SetResourceSelector(schema.ResourceSelector{ID: teamID}).
		SaveX(suite.Ctx)
	suite.DB.Group.Create().SetName(user.Email + teamID.String()).AddPermissionIDs(perm.ID).AddUserIDs(user.ID).SaveX(suite.Ctx)
}

func (suite *GithubHandlerSuite) TestInstallationsFollowTheTeam() {
	installations, err := suite.listInstallations(suite.as(suite.creator), suite.team.ID)
	suite.Require().NoError(err)
	suite.Len(installations, 1, "the creator builds from their own connection in any team")

	suite.shareWithTeam(suite.team.ID)
	suite.createService("in-team", suite.team.ID, suite.installation.ID)
	suite.createService("elsewhere", suite.otherTeam.ID, suite.installation.ID)

	installations, err = suite.listInstallations(suite.as(suite.teamViewer), suite.team.ID)
	suite.Require().NoError(err)
	suite.Require().Len(installations, 1)
	suite.Equal(suite.installation.ID, installations[0].ID)
	suite.Equal("test-org", installations[0].AccountLogin)
	suite.Equal(1, installations[0].ServiceCount)

	installations, err = suite.listInstallations(suite.as(suite.outsider), suite.otherTeam.ID)
	suite.Require().NoError(err)
	suite.Empty(installations)

	_, err = suite.listInstallations(suite.as(suite.outsider), suite.team.ID)
	suite.assertStatus(err, 404)

	suite.DB.GithubApp.UpdateOneID(suite.app.ID).SetSharedWithAllTeams(true).ExecX(suite.Ctx)
	installations, err = suite.listInstallations(suite.as(suite.outsider), suite.otherTeam.ID)
	suite.Require().NoError(err)
	suite.Len(installations, 1)
}

func (suite *GithubHandlerSuite) TestConnectionSharedWithAnotherTeamStaysThere() {
	suite.shareWithTeam(suite.team.ID)
	suite.grant(suite.teamViewer, schema.ActionEditor, suite.otherTeam.ID)

	installations, err := suite.listInstallations(suite.as(suite.teamViewer), suite.otherTeam.ID)
	suite.Require().NoError(err)
	suite.Empty(installations)

	_, err = suite.repositoryDetail(suite.as(suite.teamViewer), suite.otherTeam.ID)
	suite.assertStatus(err, 404)
}

func (suite *GithubHandlerSuite) TestAPIKeyOnlySeesInstallationsOfItsTeams() {
	suite.shareWithTeam(suite.team.ID)
	suite.grant(suite.teamViewer, schema.ActionViewer, suite.otherTeam.ID)
	project := suite.DB.Project.Create().
		SetKubernetesName("project").
		SetName("project").
		SetTeamID(suite.team.ID).
		SetKubernetesSecret("project-secret").
		SaveX(suite.Ctx)

	keyFor := func(resourceType schema.ResourceType, resourceID uuid.UUID) context.Context {
		return permissions_repo.WithAPIKeyAccess(suite.as(suite.teamViewer), permissions_repo.APIKeyAccess{
			Role:      schema.ActionViewer,
			Resources: []schema.APIKeyResource{{ResourceType: resourceType, ResourceID: resourceID}},
		})
	}

	installations, err := suite.listInstallations(keyFor(schema.ResourceTypeTeam, suite.team.ID), suite.team.ID)
	suite.Require().NoError(err)
	suite.Len(installations, 1)

	installations, err = suite.listInstallations(keyFor(schema.ResourceTypeProject, project.ID), suite.team.ID)
	suite.Require().NoError(err)
	suite.Len(installations, 1, "a key limited to a project builds in the project's team")

	_, err = suite.listInstallations(keyFor(schema.ResourceTypeTeam, suite.otherTeam.ID), suite.team.ID)
	suite.assertStatus(err, 404)
}

func (suite *GithubHandlerSuite) updateTeams(user *ent.User, add []uuid.UUID, remove []uuid.UUID) (*GithubAppUpdateTeamsResponse, error) {
	input := &GithubAppUpdateTeamsInput{}
	input.Body.UUID = suite.app.UUID
	input.Body.AddTeamIDs = add
	input.Body.RemoveTeamIDs = remove
	return suite.handlers.HandleUpdateGithubAppTeams(suite.as(user), input)
}

func (suite *GithubHandlerSuite) TestCreatorSharesWithTeamsTheyEdit() {
	resp, err := suite.updateTeams(suite.creator, []uuid.UUID{suite.team.ID}, nil)
	suite.Require().NoError(err)
	suite.Equal([]*GithubAppTeamAPIResponse{{ID: suite.team.ID, Name: "team"}}, resp.Body.Data.Teams)

	_, err = suite.updateTeams(suite.creator, []uuid.UUID{suite.otherTeam.ID}, nil)
	suite.assertStatus(err, 403)

	resp, err = suite.updateTeams(suite.creator, nil, []uuid.UUID{suite.team.ID})
	suite.Require().NoError(err)
	suite.Empty(resp.Body.Data.Teams)
}

func (suite *GithubHandlerSuite) TestSystemAdminSharesWithAnyTeam() {
	_, err := suite.updateTeams(suite.admin, []uuid.UUID{suite.team.ID}, nil)
	suite.assertStatus(err, 404)

	suite.shareWithTeam(suite.team.ID)
	resp, err := suite.updateTeams(suite.admin, []uuid.UUID{suite.otherTeam.ID}, nil)
	suite.Require().NoError(err)
	suite.Len(resp.Body.Data.Teams, 2)

	_, err = suite.updateTeams(suite.admin, []uuid.UUID{uuid.New()}, nil)
	suite.assertStatus(err, 404)

	_, err = suite.updateTeams(suite.admin, []uuid.UUID{suite.team.ID}, []uuid.UUID{suite.team.ID})
	suite.assertStatus(err, 400)
}

func (suite *GithubHandlerSuite) setAllTeams(user *ent.User, allTeams bool) (*GithubAppUpdateTeamsResponse, error) {
	input := &GithubAppUpdateTeamsInput{}
	input.Body.UUID = suite.app.UUID
	input.Body.AllTeams = &allTeams
	return suite.handlers.HandleUpdateGithubAppTeams(suite.as(user), input)
}

func (suite *GithubHandlerSuite) TestOnlySystemAdminSharesWithAllTeams() {
	_, err := suite.setAllTeams(suite.creator, true)
	suite.assertStatus(err, 403)
	suite.Empty(suite.listApps(suite.outsider, &GithubAppListInput{}))

	suite.shareWithTeam(suite.team.ID)
	resp, err := suite.setAllTeams(suite.admin, true)
	suite.Require().NoError(err)
	suite.True(resp.Body.Data.SharedWithAllTeams)

	suite.Len(suite.listApps(suite.outsider, &GithubAppListInput{}), 1)
	suite.Len(suite.listApps(suite.outsider, &GithubAppListInput{TeamID: suite.otherTeam.ID}), 1)

	_, err = suite.setAllTeams(suite.teamEditor, false)
	suite.assertStatus(err, 403)

	resp, err = suite.setAllTeams(suite.creator, false)
	suite.Require().NoError(err)
	suite.False(resp.Body.Data.SharedWithAllTeams)
	suite.Empty(suite.listApps(suite.outsider, &GithubAppListInput{}))
}

func (suite *GithubHandlerSuite) TestAppSharedWithAllTeamsNeedsAdminOnceCreatorIsGone() {
	suite.DB.GithubApp.UpdateOneID(suite.app.ID).SetSharedWithAllTeams(true).ExecX(suite.Ctx)
	suite.DB.User.DeleteOneID(suite.creator.ID).ExecX(suite.Ctx)

	_, err := suite.setAllTeams(suite.admin, false)
	suite.assertStatus(err, 400)

	suite.assertStatus(suite.deleteApp(suite.teamEditor), 403)

	suite.githubClient.EXPECT().DeleteInstallation(mock.Anything, mock.Anything, suite.installation.ID).Return(nil).Once()
	suite.Require().NoError(suite.deleteApp(suite.admin))
}

func (suite *GithubHandlerSuite) TestTeamEditorCanOnlyRemoveTheirTeam() {
	suite.shareWithTeam(suite.team.ID)

	_, err := suite.updateTeams(suite.teamEditor, []uuid.UUID{suite.otherTeam.ID}, nil)
	suite.assertStatus(err, 403)

	suite.shareWithTeam(suite.otherTeam.ID)
	_, err = suite.updateTeams(suite.teamEditor, nil, []uuid.UUID{suite.otherTeam.ID})
	suite.assertStatus(err, 403)

	_, err = suite.updateTeams(suite.teamViewer, nil, []uuid.UUID{suite.team.ID})
	suite.assertStatus(err, 403)

	resp, err := suite.updateTeams(suite.teamEditor, nil, []uuid.UUID{suite.team.ID})
	suite.Require().NoError(err)
	suite.Nil(resp.Body.Data, "the editor no longer sees the app")
	suite.Len(suite.listApps(suite.outsider, &GithubAppListInput{}), 1)

	_, err = suite.updateTeams(suite.teamEditor, nil, []uuid.UUID{suite.team.ID})
	suite.assertStatus(err, 404)
}

func (suite *GithubHandlerSuite) TestAppWithoutCreatorKeepsATeam() {
	suite.shareWithTeam(suite.team.ID)
	suite.DB.User.DeleteOneID(suite.creator.ID).ExecX(suite.Ctx)

	_, err := suite.updateTeams(suite.teamEditor, nil, []uuid.UUID{suite.team.ID})
	suite.assertStatus(err, 400)

	_, err = suite.updateTeams(suite.admin, []uuid.UUID{suite.otherTeam.ID}, nil)
	suite.Require().NoError(err)
	_, err = suite.updateTeams(suite.teamEditor, nil, []uuid.UUID{suite.team.ID})
	suite.Require().NoError(err)
}

func (suite *GithubHandlerSuite) TestConnectingWithATeamNeedsTeamEditor() {
	input := &GitHubAppCreateInput{RedirectURL: "http://localhost/connected", TeamID: suite.team.ID}
	_, err := suite.handlers.HandleGithubAppCreate(suite.as(suite.teamViewer), input)
	suite.assertStatus(err, 403)

	_, err = suite.handlers.HandleGithubAppCreate(suite.as(suite.outsider), input)
	suite.assertStatus(err, 403)
}

func (suite *GithubHandlerSuite) deleteApp(user *ent.User) error {
	input := &GithubAppDeleteInput{}
	input.Body.UUID = suite.app.UUID
	_, err := suite.handlers.HandleDeleteGithubApp(suite.as(user), input)
	return err
}

func (suite *GithubHandlerSuite) TestDeleteAppUninstallsAndDetachesServices() {
	suite.shareWithTeam(suite.team.ID)
	service := suite.createService("svc", suite.team.ID, suite.installation.ID)

	suite.assertStatus(suite.deleteApp(suite.teamEditor), 403)

	suite.githubClient.EXPECT().DeleteInstallation(mock.Anything, mock.Anything, suite.installation.ID).Return(nil).Once()
	suite.Require().NoError(suite.deleteApp(suite.creator))

	suite.False(suite.DB.GithubApp.Query().ExistX(suite.Ctx))
	suite.False(suite.DB.GithubInstallation.Query().ExistX(suite.Ctx))
	suite.Nil(suite.DB.Service.GetX(suite.Ctx, service.ID).GithubInstallationID)
}

func (suite *GithubHandlerSuite) TestTeamEditorRemovesAppOnceCreatorIsGone() {
	suite.shareWithTeam(suite.team.ID)
	suite.DB.User.DeleteOneID(suite.creator.ID).ExecX(suite.Ctx)

	suite.assertStatus(suite.deleteApp(suite.teamViewer), 403)

	suite.githubClient.EXPECT().DeleteInstallation(mock.Anything, mock.Anything, suite.installation.ID).Return(nil).Once()
	suite.Require().NoError(suite.deleteApp(suite.teamEditor))
	suite.False(suite.DB.GithubApp.Query().ExistX(suite.Ctx))
}

func (suite *GithubHandlerSuite) TestAppSharedWithOtherTeamsNeedsAdminOnceCreatorIsGone() {
	suite.shareWithTeam(suite.team.ID)
	suite.shareWithTeam(suite.otherTeam.ID)
	suite.DB.User.DeleteOneID(suite.creator.ID).ExecX(suite.Ctx)

	suite.assertStatus(suite.deleteApp(suite.teamEditor), 403)

	suite.githubClient.EXPECT().DeleteInstallation(mock.Anything, mock.Anything, suite.installation.ID).Return(nil).Once()
	suite.Require().NoError(suite.deleteApp(suite.admin))
	suite.False(suite.DB.GithubApp.Query().ExistX(suite.Ctx))
}

func (suite *GithubHandlerSuite) TestDeleteInstallation() {
	service := suite.createService("svc", suite.team.ID, suite.installation.ID)
	input := &GithubInstallationDeleteInput{}
	input.Body.InstallationID = suite.installation.ID

	_, err := suite.handlers.HandleDeleteGithubInstallation(suite.as(suite.teamEditor), input)
	suite.assertStatus(err, 404)

	suite.githubClient.EXPECT().DeleteInstallation(mock.Anything, mock.Anything, suite.installation.ID).Return(nil).Once()
	_, err = suite.handlers.HandleDeleteGithubInstallation(suite.as(suite.creator), input)
	suite.Require().NoError(err)

	suite.True(suite.DB.GithubApp.Query().ExistX(suite.Ctx))
	suite.False(suite.DB.GithubInstallation.Query().ExistX(suite.Ctx))
	suite.Nil(suite.DB.Service.GetX(suite.Ctx, service.ID).GithubInstallationID)
}

func (suite *GithubHandlerSuite) TestRepositoriesSkipUninstalledAndSuspended() {
	suite.DB.GithubInstallation.Create().
		SetID(2).
		SetGithubAppID(suite.app.ID).
		SetAccountID(2).
		SetAccountLogin("gone").
		SetAccountType(githubinstallation.AccountTypeUser).
		SetAccountURL("https://github.com/gone").
		SetActive(false).
		SaveX(suite.Ctx)
	suite.DB.GithubInstallation.Create().
		SetID(3).
		SetGithubAppID(suite.app.ID).
		SetAccountID(3).
		SetAccountLogin("paused").
		SetAccountType(githubinstallation.AccountTypeUser).
		SetAccountURL("https://github.com/paused").
		SetSuspended(true).
		SaveX(suite.Ctx)

	suite.githubClient.EXPECT().
		ReadInstallationRepositories(mock.Anything, mock.MatchedBy(func(installations []*ent.GithubInstallation) bool {
			return len(installations) == 1 && installations[0].ID == suite.installation.ID
		})).
		Return(nil, nil).Once()
	resp, err := suite.handlers.HandleListGithubRepositories(suite.as(suite.creator), &GithubRepositoryListInput{TeamID: suite.team.ID})
	suite.Require().NoError(err)
	suite.Empty(resp.Body.Data)
}

// startAppFlow begins a connection as the user and returns the state GitHub will send back
func (suite *GithubHandlerSuite) startAppFlow(user *ent.User, teamID uuid.UUID) string {
	var state string
	suite.githubClient.EXPECT().
		CreateAppManifest("https://unbind.example.com/connected", mock.Anything, false).
		RunAndReturn(func(redirectUrl, setupUrl string, forOrganization bool) (*github_integration.GitHubAppManifest, error) {
			parsed, err := url.Parse(setupUrl)
			suite.Require().NoError(err)
			state = parsed.Query().Get("id")
			return &github_integration.GitHubAppManifest{Name: "unbind-generated"}, nil
		}).Once()
	_, err := suite.handlers.HandleGithubAppCreate(suite.as(user), &GitHubAppCreateInput{RedirectURL: "https://unbind.example.com/connected", TeamID: teamID})
	suite.Require().NoError(err)
	suite.Require().NotEmpty(state)
	return state
}

func (suite *GithubHandlerSuite) saveInput(state string) *GithubAppSaveInput {
	input := &GithubAppSaveInput{}
	input.Body.Code = "code"
	input.Body.State = state
	return input
}

func (suite *GithubHandlerSuite) TestCreateRejectsInvalidRedirectURL() {
	for _, redirectURL := range []string{"javascript:alert(1)", "/connected", "ftp://unbind.example.com/connected"} {
		_, err := suite.handlers.HandleGithubAppCreate(suite.as(suite.creator), &GitHubAppCreateInput{RedirectURL: redirectURL})
		suite.assertStatus(err, http.StatusBadRequest)
	}
}

func (suite *GithubHandlerSuite) TestSaveRenamedApp() {
	state := suite.startAppFlow(suite.creator, suite.team.ID)
	suite.githubClient.EXPECT().
		ManifestCodeConversion(mock.Anything, "code").
		Return(&github.AppConfig{
			ID:            new(int64(999)),
			Name:          new("My Unbind"),
			Slug:          new("my-unbind"),
			ClientID:      new("client"),
			ClientSecret:  new("secret"),
			WebhookSecret: new("webhook"),
			PEM:           new("pem"),
			Owner:         &github.User{Login: new("yekta"), Type: new("User")},
		}, nil).Once()

	resp, err := suite.handlers.HandleGithubAppSave(suite.as(suite.creator), suite.saveInput(state))
	suite.Require().NoError(err)
	suite.Equal("https://github.com/apps/my-unbind/installations/new", resp.Body.Data.InstallURL)
	suite.Equal(state, resp.Body.Data.UUID.String())

	app := suite.DB.GithubApp.Query().Where(githubapp.ID(999)).OnlyX(suite.Ctx)
	suite.Equal("My Unbind", app.Name)
	suite.Equal("my-unbind", app.Slug)
	suite.Equal(suite.creator.ID, *app.CreatedBy)
	suite.Equal([]uuid.UUID{suite.team.ID}, app.QueryTeams().IDsX(suite.Ctx))

	_, err = suite.handlers.HandleGithubAppSave(suite.as(suite.creator), suite.saveInput(state))
	suite.assertStatus(err, http.StatusBadRequest)
}

func (suite *GithubHandlerSuite) TestSaveRejectsAnotherUser() {
	state := suite.startAppFlow(suite.creator, uuid.Nil)

	_, err := suite.handlers.HandleGithubAppSave(suite.as(suite.teamEditor), suite.saveInput(state))
	suite.assertStatus(err, http.StatusForbidden)
	suite.False(suite.DB.GithubApp.Query().Where(githubapp.ID(999)).ExistX(suite.Ctx))
}

func (suite *GithubHandlerSuite) TestSaveRejectsExpiredOrUnknownState() {
	state := suite.startAppFlow(suite.creator, uuid.Nil)
	suite.redis.FastForward(appFlowTTL + time.Minute)

	for _, state := range []string{state, uuid.NewString()} {
		_, err := suite.handlers.HandleGithubAppSave(suite.as(suite.creator), suite.saveInput(state))
		suite.assertStatus(err, http.StatusBadRequest)
	}
}

func TestGithubHandlerSuite(t *testing.T) {
	suite.Run(t, new(GithubHandlerSuite))
}
