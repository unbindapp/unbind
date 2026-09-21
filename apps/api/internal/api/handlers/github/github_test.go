package github_handler

import (
	"context"
	"testing"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/githubinstallation"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/api/apictx"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/repositories/repositories"
	repository "github.com/unbindapp/unbind-api/internal/repositories/repositorytest"
)

type GithubHandlerSuite struct {
	repository.RepositoryBaseSuite
	handlers     *HandlerGroup
	creator      *ent.User
	systemViewer *ent.User
	teamViewer   *ent.User
	app          *ent.GithubApp
	installation *ent.GithubInstallation
}

func (suite *GithubHandlerSuite) SetupTest() {
	suite.RepositoryBaseSuite.SetupTest()
	suite.handlers = &HandlerGroup{srv: &server.Server{Repository: repositories.NewRepositories(suite.DB)}}

	superuser := schema.ResourceSelector{Superuser: true}
	suite.creator = suite.userWithGrant("creator@example.com", schema.ActionEditor, schema.ResourceTypeSystem, superuser)
	suite.systemViewer = suite.userWithGrant("viewer@example.com", schema.ActionViewer, schema.ResourceTypeSystem, superuser)
	suite.teamViewer = suite.userWithGrant("team@example.com", schema.ActionViewer, schema.ResourceTypeTeam, schema.ResourceSelector{ID: uuid.New()})

	suite.app = suite.DB.GithubApp.Create().
		SetID(12345).
		SetUUID(uuid.New()).
		SetClientID("client-id").
		SetClientSecret("client-secret").
		SetWebhookSecret("webhook-secret").
		SetPrivateKey("private-key").
		SetName("Test App").
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

func (suite *GithubHandlerSuite) userWithGrant(email string, action schema.PermittedAction, resourceType schema.ResourceType, selector schema.ResourceSelector) *ent.User {
	perm := suite.DB.Permission.Create().
		SetAction(action).
		SetResourceType(resourceType).
		SetResourceSelector(selector).
		SaveX(suite.Ctx)
	group := suite.DB.Group.Create().SetName(email).AddPermissionIDs(perm.ID).SaveX(suite.Ctx)
	return suite.DB.User.Create().SetEmail(email).SetPasswordHash("x").AddGroupIDs(group.ID).SaveX(suite.Ctx)
}

func (suite *GithubHandlerSuite) as(user *ent.User) context.Context {
	return context.WithValue(suite.Ctx, apictx.UserKey, user)
}

func (suite *GithubHandlerSuite) assertForbidden(err error) {
	var statusErr huma.StatusError
	suite.Require().ErrorAs(err, &statusErr)
	suite.Equal(403, statusErr.GetStatus())
}

func (suite *GithubHandlerSuite) TestInstallationsVisibleToEverySystemViewer() {
	resp, err := suite.handlers.HandleListGithubAppInstallations(suite.as(suite.systemViewer), &server.BaseAuthInput{})
	suite.Require().NoError(err)
	suite.Require().Len(resp.Body.Data, 1)
	suite.Equal(suite.installation.ID, resp.Body.Data[0].ID)
	suite.Equal(suite.app.ID, resp.Body.Data[0].GithubAppID)
}

func (suite *GithubHandlerSuite) TestInstallationsNeedSystemViewer() {
	_, err := suite.handlers.HandleListGithubAppInstallations(suite.as(suite.teamViewer), &server.BaseAuthInput{})
	suite.assertForbidden(err)
}

func (suite *GithubHandlerSuite) TestAppsNeedSystemViewer() {
	_, err := suite.handlers.HandleListGithubApps(suite.as(suite.teamViewer), &GithubAppListInput{})
	suite.assertForbidden(err)

	_, err = suite.handlers.HandleGetGithubApp(suite.as(suite.teamViewer), &GithubAppGetInput{UUID: suite.app.UUID})
	suite.assertForbidden(err)

	resp, err := suite.handlers.HandleListGithubApps(suite.as(suite.systemViewer), &GithubAppListInput{WithInstallations: true})
	suite.Require().NoError(err)
	suite.Require().Len(resp.Body.Data, 1)
	suite.Equal(suite.creator.ID, *resp.Body.Data[0].CreatedBy)
	suite.Len(resp.Body.Data[0].Installations, 1)
}

func (suite *GithubHandlerSuite) TestConnectingNeedsSystemEditor() {
	input := &GitHubAppCreateInput{RedirectURL: "http://localhost/connected"}

	_, err := suite.handlers.HandleGithubAppCreate(suite.as(suite.systemViewer), input)
	suite.assertForbidden(err)

	_, err = suite.handlers.HandleGithubAppCreate(suite.as(suite.teamViewer), input)
	suite.assertForbidden(err)
}

func TestGithubHandlerSuite(t *testing.T) {
	suite.Run(t, new(GithubHandlerSuite))
}
