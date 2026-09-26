package github_repo

import (
	"testing"

	"github.com/google/go-github/v69/github"
	"github.com/google/uuid"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/githubapp"
	"github.com/unbindapp/unbind-api/ent/githubinstallation"
	"github.com/unbindapp/unbind-api/ent/predicate"
	team_pkg "github.com/unbindapp/unbind-api/ent/team"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	repository "github.com/unbindapp/unbind-api/internal/repositories/repositorytest"
	"golang.org/x/crypto/bcrypt"
)

type GithubAppSuite struct {
	repository.RepositoryBaseSuite
	githubRepo *GithubRepository
	testUser   *ent.User
	testApp    *ent.GithubApp
}

func (suite *GithubAppSuite) SetupTest() {
	suite.RepositoryBaseSuite.SetupTest()
	suite.githubRepo = NewGithubRepository(suite.DB)

	// Create test user for createdBy
	pwd, _ := bcrypt.GenerateFromPassword([]byte("test-password"), 1)
	suite.testUser = suite.DB.User.Create().
		SetEmail("test@example.com").
		SetPasswordHash(string(pwd)).
		SaveX(suite.Ctx)

	// Create test github app
	suite.testApp = suite.DB.GithubApp.Create().
		SetID(12345).
		SetUUID(uuid.New()).
		SetClientID("test-client-id").
		SetClientSecret("test-client-secret").
		SetWebhookSecret("test-webhook-secret").
		SetPrivateKey("test-private-key").
		SetName("Test App").
		SetCreatedBy(suite.testUser.ID).
		SaveX(suite.Ctx)
}

func (suite *GithubAppSuite) TearDownTest() {
	suite.RepositoryBaseSuite.TearDownTest()
	suite.githubRepo = nil
	suite.testUser = nil
	suite.testApp = nil
}

func (suite *GithubAppSuite) TestDeletingCreatorKeepsApp() {
	installation := suite.DB.GithubInstallation.Create().
		SetID(67890).
		SetGithubAppID(suite.testApp.ID).
		SetAccountID(11111).
		SetAccountLogin("test-org").
		SetAccountType(githubinstallation.AccountTypeOrganization).
		SetAccountURL("https://github.com/test-org").
		SaveX(suite.Ctx)

	suite.DB.User.DeleteOneID(suite.testUser.ID).ExecX(suite.Ctx)

	app, err := suite.githubRepo.GetGithubAppByID(suite.Ctx, suite.testApp.ID)
	suite.NoError(err)
	suite.Nil(app.CreatedBy)

	kept, err := suite.githubRepo.GetInstallationByID(suite.Ctx, installation.ID)
	suite.NoError(err)
	suite.Equal(suite.testApp.ID, kept.GithubAppID)
}

func (suite *GithubAppSuite) TestGetApp() {
	suite.Run("GetApp Success", func() {
		app, err := suite.githubRepo.GetApp(suite.Ctx)
		suite.NoError(err)
		suite.NotNil(app)
		suite.Equal(suite.testApp.ID, app.ID)
		suite.Equal("Test App", app.Name)
		suite.Equal("test-client-id", app.ClientID)
	})

	suite.Run("GetApp Multiple Apps - Returns First", func() {
		// Create another app
		suite.DB.GithubApp.Create().
			SetID(67890).
			SetUUID(uuid.New()).
			SetClientID("second-client-id").
			SetClientSecret("second-client-secret").
			SetWebhookSecret("second-webhook-secret").
			SetPrivateKey("second-private-key").
			SetName("Second App").
			SetCreatedBy(suite.testUser.ID).
			SaveX(suite.Ctx)

		app, err := suite.githubRepo.GetApp(suite.Ctx)
		suite.NoError(err)
		suite.NotNil(app)
		// Should return the first app (by creation order)
		suite.Equal(suite.testApp.ID, app.ID)
	})

	suite.Run("GetApp No Apps", func() {
		// Delete the test app
		suite.DB.GithubApp.Delete().ExecX(suite.Ctx)

		app, err := suite.githubRepo.GetApp(suite.Ctx)
		suite.Error(err)
		suite.Nil(app)
	})

	suite.Run("GetApp Error when DB closed", func() {
		suite.DB.Close()
		app, err := suite.githubRepo.GetApp(suite.Ctx)
		suite.Error(err)
		suite.Nil(app)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *GithubAppSuite) TestGetApps() {
	suite.Run("GetApps Success Without Installations", func() {
		apps, err := suite.githubRepo.GetApps(suite.Ctx, false)
		suite.NoError(err)
		suite.Len(apps, 1)
		suite.Equal(suite.testApp.ID, apps[0].ID)
		suite.Equal("Test App", apps[0].Name)
		// Installations edge should not be loaded
		suite.Nil(apps[0].Edges.Installations)
	})

	suite.Run("GetApps Success With Installations", func() {
		apps, err := suite.githubRepo.GetApps(suite.Ctx, true)
		suite.NoError(err)
		suite.Len(apps, 1)
		suite.Equal(suite.testApp.ID, apps[0].ID)
		// Installations edge should be loaded (empty slice)
		suite.NotNil(apps[0].Edges.Installations)
		suite.Len(apps[0].Edges.Installations, 0)
	})

	suite.Run("GetApps Multiple Apps", func() {
		// Create additional apps
		app2 := suite.DB.GithubApp.Create().
			SetID(67890).
			SetUUID(uuid.New()).
			SetClientID("second-client-id").
			SetClientSecret("second-client-secret").
			SetWebhookSecret("second-webhook-secret").
			SetPrivateKey("second-private-key").
			SetName("Second App").
			SetCreatedBy(suite.testUser.ID).
			SaveX(suite.Ctx)

		app3 := suite.DB.GithubApp.Create().
			SetID(11111).
			SetUUID(uuid.New()).
			SetClientID("third-client-id").
			SetClientSecret("third-client-secret").
			SetWebhookSecret("third-webhook-secret").
			SetPrivateKey("third-private-key").
			SetName("Third App").
			SetCreatedBy(suite.testUser.ID).
			SaveX(suite.Ctx)

		apps, err := suite.githubRepo.GetApps(suite.Ctx, false)
		suite.NoError(err)
		suite.Len(apps, 3)

		// Verify all apps are returned
		appIDs := make([]int64, len(apps))
		for i, app := range apps {
			appIDs[i] = app.ID
		}
		suite.Contains(appIDs, suite.testApp.ID)
		suite.Contains(appIDs, app2.ID)
		suite.Contains(appIDs, app3.ID)
	})

	suite.Run("GetApps Empty Result", func() {
		// Delete all apps
		suite.DB.GithubApp.Delete().ExecX(suite.Ctx)

		apps, err := suite.githubRepo.GetApps(suite.Ctx, false)
		suite.NoError(err)
		suite.Len(apps, 0)
	})

	suite.Run("GetApps Error when DB closed", func() {
		suite.DB.Close()
		apps, err := suite.githubRepo.GetApps(suite.Ctx, false)
		suite.Error(err)
		suite.Nil(apps)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *GithubAppSuite) TestCreateApp() {
	suite.Run("CreateApp Success", func() {
		appConfig := &github.AppConfig{
			ID:            utils.ToPtr[int64](99999),
			ClientID:      new("new-client-id"),
			ClientSecret:  new("new-client-secret"),
			WebhookSecret: new("new-webhook-secret"),
			PEM:           new("new-private-key"),
			Name:          new("New App"),
		}
		uniqueUUID := uuid.New()

		app, err := suite.githubRepo.CreateApp(suite.Ctx, uniqueUUID, appConfig, suite.testUser.ID, nil)
		suite.NoError(err)
		suite.NotNil(app)
		suite.Equal(int64(99999), app.ID)
		suite.Equal(uniqueUUID, app.UUID)
		suite.Equal("new-client-id", app.ClientID)
		suite.Equal("new-client-secret", app.ClientSecret)
		suite.Equal("new-webhook-secret", app.WebhookSecret)
		suite.Equal("new-private-key", app.PrivateKey)
		suite.Equal("New App", app.Name)
		suite.Equal(suite.testUser.ID, *app.CreatedBy)
		suite.NotZero(app.CreatedAt)
		suite.NotZero(app.UpdatedAt)
	})

	suite.Run("CreateApp Error - Duplicate ID", func() {
		appConfig := &github.AppConfig{
			ID:            new(suite.testApp.ID), // Same ID as existing app
			ClientID:      new("duplicate-client-id"),
			ClientSecret:  new("duplicate-client-secret"),
			WebhookSecret: new("duplicate-webhook-secret"),
			PEM:           new("duplicate-private-key"),
			Name:          new("Duplicate App"),
		}
		uniqueUUID := uuid.New()

		app, err := suite.githubRepo.CreateApp(suite.Ctx, uniqueUUID, appConfig, suite.testUser.ID, nil)
		suite.Error(err)
		suite.Nil(app)
	})

	suite.Run("CreateApp Error - Duplicate UUID", func() {
		appConfig := &github.AppConfig{
			ID:            utils.ToPtr[int64](88888),
			ClientID:      new("uuid-duplicate-client-id"),
			ClientSecret:  new("uuid-duplicate-client-secret"),
			WebhookSecret: new("uuid-duplicate-webhook-secret"),
			PEM:           new("uuid-duplicate-private-key"),
			Name:          new("UUID Duplicate App"),
		}

		app, err := suite.githubRepo.CreateApp(suite.Ctx, suite.testApp.UUID, appConfig, suite.testUser.ID, nil) // Same UUID
		suite.Error(err)
		suite.Nil(app)
	})

	suite.Run("CreateApp Error - Invalid User ID", func() {
		appConfig := &github.AppConfig{
			ID:            utils.ToPtr[int64](77777),
			ClientID:      new("invalid-user-client-id"),
			ClientSecret:  new("invalid-user-client-secret"),
			WebhookSecret: new("invalid-user-webhook-secret"),
			PEM:           new("invalid-user-private-key"),
			Name:          new("Invalid User App"),
		}
		uniqueUUID := uuid.New()
		invalidUserID := uuid.New()

		app, err := suite.githubRepo.CreateApp(suite.Ctx, uniqueUUID, appConfig, invalidUserID, nil)
		suite.Error(err)
		suite.Nil(app)
	})

	suite.Run("CreateApp Error when DB closed", func() {
		appConfig := &github.AppConfig{
			ID:            utils.ToPtr[int64](66666),
			ClientID:      new("closed-db-client-id"),
			ClientSecret:  new("closed-db-client-secret"),
			WebhookSecret: new("closed-db-webhook-secret"),
			PEM:           new("closed-db-private-key"),
			Name:          new("Closed DB App"),
		}
		uniqueUUID := uuid.New()

		suite.DB.Close()
		app, err := suite.githubRepo.CreateApp(suite.Ctx, uniqueUUID, appConfig, suite.testUser.ID, nil)
		suite.Error(err)
		suite.Nil(app)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *GithubAppSuite) TestGetGithubAppByID() {
	suite.Run("GetGithubAppByID Success", func() {
		app, err := suite.githubRepo.GetGithubAppByID(suite.Ctx, suite.testApp.ID)
		suite.NoError(err)
		suite.NotNil(app)
		suite.Equal(suite.testApp.ID, app.ID)
		suite.Equal("Test App", app.Name)
		suite.Equal("test-client-id", app.ClientID)
	})

	suite.Run("GetGithubAppByID Not Found", func() {
		nonExistentID := int64(99999)
		app, err := suite.githubRepo.GetGithubAppByID(suite.Ctx, nonExistentID)
		suite.Error(err)
		suite.Nil(app)
	})

	suite.Run("GetGithubAppByID Error when DB closed", func() {
		suite.DB.Close()
		app, err := suite.githubRepo.GetGithubAppByID(suite.Ctx, suite.testApp.ID)
		suite.Error(err)
		suite.Nil(app)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *GithubAppSuite) TestGetGithubAppByUUID() {
	suite.Run("GetGithubAppByUUID Success", func() {
		app, err := suite.githubRepo.GetGithubAppByUUID(suite.Ctx, suite.testApp.UUID)
		suite.NoError(err)
		suite.NotNil(app)
		suite.Equal(suite.testApp.ID, app.ID)
		suite.Equal(suite.testApp.UUID, app.UUID)
		suite.Equal("Test App", app.Name)
		// Installations edge should be loaded
		suite.NotNil(app.Edges.Installations)
		suite.Len(app.Edges.Installations, 0) // No installations created
	})

	suite.Run("GetGithubAppByUUID Not Found", func() {
		nonExistentUUID := uuid.New()
		app, err := suite.githubRepo.GetGithubAppByUUID(suite.Ctx, nonExistentUUID)
		suite.Error(err)
		suite.Nil(app)
	})

	suite.Run("GetGithubAppByUUID Error when DB closed", func() {
		suite.DB.Close()
		app, err := suite.githubRepo.GetGithubAppByUUID(suite.Ctx, suite.testApp.UUID)
		suite.Error(err)
		suite.Nil(app)
		suite.ErrorContains(err, "database is closed")
	})
}

func TestGithubAppSuite(t *testing.T) {
	suite.Run(t, new(GithubAppSuite))
}

func (suite *GithubAppSuite) createTeam(name string) *ent.Team {
	return suite.DB.Team.Create().
		SetKubernetesName(name).
		SetName(name).
		SetNamespace(name).
		SetKubernetesSecret(name + "-secret").
		SaveX(suite.Ctx)
}

func (suite *GithubAppSuite) TestVisibleApps() {
	team := suite.createTeam("team")
	otherTeam := suite.createTeam("other")
	teammate := suite.DB.User.Create().SetEmail("teammate@example.com").SetPasswordHash("x").SaveX(suite.Ctx)
	sees := func(visibility AppVisibility, filter AppFilter) int {
		apps, err := suite.githubRepo.GetVisibleApps(suite.Ctx, visibility, filter)
		suite.Require().NoError(err)
		return len(apps)
	}
	memberOf := func(teamID uuid.UUID) predicate.Team { return team_pkg.ID(teamID) }

	suite.Run("private app is only visible to its creator", func() {
		suite.Equal(1, sees(AppVisibility{UserID: suite.testUser.ID, Teams: memberOf(team.ID)}, AppFilter{}))
		suite.Equal(0, sees(AppVisibility{UserID: teammate.ID, Teams: memberOf(team.ID)}, AppFilter{}))
		suite.Equal(0, sees(AppVisibility{UserID: teammate.ID}, AppFilter{}))
	})

	suite.Run("shared app is visible to the team", func() {
		_, err := suite.githubRepo.SetAppTeam(suite.Ctx, suite.testApp.ID, &team.ID)
		suite.Require().NoError(err)

		suite.Equal(1, sees(AppVisibility{UserID: teammate.ID, Teams: memberOf(team.ID)}, AppFilter{}))
		suite.Equal(1, sees(AppVisibility{UserID: teammate.ID, Teams: memberOf(team.ID)}, AppFilter{TeamID: &team.ID}))
		suite.Equal(0, sees(AppVisibility{UserID: teammate.ID, Teams: memberOf(team.ID)}, AppFilter{OwnedOnly: true}))
		suite.Equal(0, sees(AppVisibility{UserID: teammate.ID, Teams: memberOf(otherTeam.ID)}, AppFilter{}))
		suite.Equal(1, sees(AppVisibility{UserID: teammate.ID}, AppFilter{}), "nil teams means every team")

		app, err := suite.githubRepo.GetVisibleAppByUUID(suite.Ctx, AppVisibility{UserID: teammate.ID, Teams: memberOf(team.ID)}, suite.testApp.UUID)
		suite.Require().NoError(err)
		suite.Equal("team", app.Edges.Team.Name)
		suite.Equal(suite.testUser.Email, app.Edges.Users.Email)
	})

	suite.Run("clearing the team makes it private again", func() {
		_, err := suite.githubRepo.SetAppTeam(suite.Ctx, suite.testApp.ID, nil)
		suite.Require().NoError(err)
		suite.Equal(0, sees(AppVisibility{UserID: teammate.ID}, AppFilter{}))
	})

	suite.Run("deleting the team unshares the app", func() {
		_, err := suite.githubRepo.SetAppTeam(suite.Ctx, suite.testApp.ID, &team.ID)
		suite.Require().NoError(err)
		suite.DB.Team.DeleteOneID(team.ID).ExecX(suite.Ctx)

		app, err := suite.githubRepo.GetGithubAppByID(suite.Ctx, suite.testApp.ID)
		suite.Require().NoError(err)
		suite.Nil(app.TeamID)
	})
}

func (suite *GithubAppSuite) TestCreateAppStoresTeamAndOwner() {
	team := suite.createTeam("team")
	appConfig := &github.AppConfig{
		ID:            utils.ToPtr[int64](4242),
		ClientID:      new("client"),
		ClientSecret:  new("secret"),
		WebhookSecret: new("webhook"),
		PEM:           new("pem"),
		Name:          new("Owned App"),
		Owner:         &github.User{Login: new("acme"), Type: new("Organization")},
	}

	app, err := suite.githubRepo.CreateApp(suite.Ctx, uuid.New(), appConfig, suite.testUser.ID, &team.ID)
	suite.Require().NoError(err)
	suite.Equal(team.ID, *app.TeamID)
	suite.Equal("acme", app.OwnerLogin)
	suite.Equal(githubapp.OwnerTypeOrganization, app.OwnerType)

	_, err = suite.githubRepo.SetAppOwner(suite.Ctx, app.ID, "someone", githubapp.OwnerTypeUser)
	suite.Require().NoError(err)
	updated, err := suite.githubRepo.GetGithubAppByID(suite.Ctx, app.ID)
	suite.Require().NoError(err)
	suite.Equal("someone", updated.OwnerLogin)
	suite.Equal(githubapp.OwnerTypeUser, updated.OwnerType)
}

func (suite *GithubAppSuite) TestDeletePrivateAppsByCreator() {
	team := suite.createTeam("team")
	shared := suite.DB.GithubApp.Create().
		SetID(777).
		SetUUID(uuid.New()).
		SetClientID("c").
		SetClientSecret("s").
		SetWebhookSecret("w").
		SetPrivateKey("p").
		SetName("Shared").
		SetCreatedBy(suite.testUser.ID).
		SetTeamID(team.ID).
		SaveX(suite.Ctx)

	deleted, err := suite.githubRepo.DeletePrivateAppsByCreator(suite.Ctx, suite.testUser.ID)
	suite.Require().NoError(err)
	suite.Equal(1, deleted)

	suite.False(suite.DB.GithubApp.Query().Where(githubapp.ID(suite.testApp.ID)).ExistX(suite.Ctx))
	suite.True(suite.DB.GithubApp.Query().Where(githubapp.ID(shared.ID)).ExistX(suite.Ctx))
}
