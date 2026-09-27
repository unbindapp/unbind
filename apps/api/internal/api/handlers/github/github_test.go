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
	suite.DB.GithubApp.UpdateOneID(suite.app.ID).SetTeamID(teamID).ExecX(suite.Ctx)
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
	suite.Nil(apps[0].TeamID)
	suite.Len(apps[0].Installations, 1)

	suite.Empty(suite.listApps(suite.teamEditor, &GithubAppListInput{}))

	_, err := suite.handlers.HandleGetGithubApp(suite.as(suite.teamEditor), &GithubAppGetInput{UUID: suite.app.UUID})
	suite.assertStatus(err, 404)

	installations, err := suite.handlers.HandleListGithubAppInstallations(suite.as(suite.teamEditor), &server.BaseAuthInput{})
	suite.Require().NoError(err)
	suite.Empty(installations.Body.Data)

	_, err = suite.handlers.HandleGetGithubRepositoryDetail(suite.as(suite.teamEditor), &GithubRepositoryDetailInput{InstallationID: suite.installation.ID, Owner: "test-org", RepoName: "repo"})
	suite.assertStatus(err, 404)
}

func (suite *GithubHandlerSuite) TestSharedAppVisibleToTeam() {
	suite.shareWithTeam(suite.team.ID)

	apps := suite.listApps(suite.teamViewer, &GithubAppListInput{})
	suite.Require().Len(apps, 1)
	suite.Equal(suite.team.ID, *apps[0].TeamID)
	suite.Equal("team", *apps[0].TeamName)

	suite.Len(suite.listApps(suite.teamViewer, &GithubAppListInput{TeamID: suite.team.ID}), 1)
	suite.Empty(suite.listApps(suite.teamViewer, &GithubAppListInput{Owned: true}))
	suite.Empty(suite.listApps(suite.outsider, &GithubAppListInput{}))

	_, err := suite.handlers.HandleListGithubApps(suite.as(suite.outsider), &GithubAppListInput{TeamID: suite.team.ID})
	suite.assertStatus(err, 403)

	installations, err := suite.handlers.HandleListGithubAppInstallations(suite.as(suite.teamViewer), &server.BaseAuthInput{})
	suite.Require().NoError(err)
	suite.Len(installations.Body.Data, 1)
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

func (suite *GithubHandlerSuite) setTeam(user *ent.User, teamID *uuid.UUID) (*GithubAppSetTeamResponse, error) {
	input := &GithubAppSetTeamInput{}
	input.Body.UUID = suite.app.UUID
	input.Body.TeamID = teamID
	return suite.handlers.HandleSetGithubAppTeam(suite.as(user), input)
}

func (suite *GithubHandlerSuite) TestCreatorSharesWithTeamsTheyEdit() {
	resp, err := suite.setTeam(suite.creator, &suite.team.ID)
	suite.Require().NoError(err)
	suite.Equal(suite.team.ID, *resp.Body.Data.TeamID)

	_, err = suite.setTeam(suite.creator, &suite.otherTeam.ID)
	suite.assertStatus(err, 403)

	resp, err = suite.setTeam(suite.creator, nil)
	suite.Require().NoError(err)
	suite.Nil(resp.Body.Data.TeamID)
}

func (suite *GithubHandlerSuite) TestTeamEditorCanOnlyUnshare() {
	suite.shareWithTeam(suite.team.ID)

	_, err := suite.setTeam(suite.teamEditor, &suite.otherTeam.ID)
	suite.assertStatus(err, 403)

	_, err = suite.setTeam(suite.teamViewer, nil)
	suite.assertStatus(err, 403)

	resp, err := suite.setTeam(suite.teamEditor, nil)
	suite.Require().NoError(err)
	suite.Nil(resp.Body.Data.TeamID)

	_, err = suite.setTeam(suite.teamEditor, nil)
	suite.assertStatus(err, 404)
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
	resp, err := suite.handlers.HandleListGithubRepositories(suite.as(suite.creator), &server.BaseAuthInput{})
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
	suite.Equal(suite.team.ID, *app.TeamID)

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
