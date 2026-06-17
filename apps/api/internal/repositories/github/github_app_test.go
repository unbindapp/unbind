package github_repo

import (
	"testing"

	"github.com/google/go-github/v69/github"
	"github.com/google/uuid"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
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
			ClientID:      utils.ToPtr("new-client-id"),
			ClientSecret:  utils.ToPtr("new-client-secret"),
			WebhookSecret: utils.ToPtr("new-webhook-secret"),
			PEM:           utils.ToPtr("new-private-key"),
			Name:          utils.ToPtr("New App"),
		}
		uniqueUUID := uuid.New()

		app, err := suite.githubRepo.CreateApp(suite.Ctx, uniqueUUID, appConfig, suite.testUser.ID)
		suite.NoError(err)
		suite.NotNil(app)
		suite.Equal(int64(99999), app.ID)
		suite.Equal(uniqueUUID, app.UUID)
		suite.Equal("new-client-id", app.ClientID)
		suite.Equal("new-client-secret", app.ClientSecret)
		suite.Equal("new-webhook-secret", app.WebhookSecret)
		suite.Equal("new-private-key", app.PrivateKey)
		suite.Equal("New App", app.Name)
		suite.Equal(suite.testUser.ID, app.CreatedBy)
		suite.NotZero(app.CreatedAt)
		suite.NotZero(app.UpdatedAt)
	})

	suite.Run("CreateApp Error - Duplicate ID", func() {
		appConfig := &github.AppConfig{
			ID:            utils.ToPtr[int64](suite.testApp.ID), // Same ID as existing app
			ClientID:      utils.ToPtr("duplicate-client-id"),
			ClientSecret:  utils.ToPtr("duplicate-client-secret"),
			WebhookSecret: utils.ToPtr("duplicate-webhook-secret"),
			PEM:           utils.ToPtr("duplicate-private-key"),
			Name:          utils.ToPtr("Duplicate App"),
		}
		uniqueUUID := uuid.New()

		app, err := suite.githubRepo.CreateApp(suite.Ctx, uniqueUUID, appConfig, suite.testUser.ID)
		suite.Error(err)
		suite.Nil(app)
	})

	suite.Run("CreateApp Error - Duplicate UUID", func() {
		appConfig := &github.AppConfig{
			ID:            utils.ToPtr[int64](88888),
			ClientID:      utils.ToPtr("uuid-duplicate-client-id"),
			ClientSecret:  utils.ToPtr("uuid-duplicate-client-secret"),
			WebhookSecret: utils.ToPtr("uuid-duplicate-webhook-secret"),
			PEM:           utils.ToPtr("uuid-duplicate-private-key"),
			Name:          utils.ToPtr("UUID Duplicate App"),
		}

		app, err := suite.githubRepo.CreateApp(suite.Ctx, suite.testApp.UUID, appConfig, suite.testUser.ID) // Same UUID
		suite.Error(err)
		suite.Nil(app)
	})

	suite.Run("CreateApp Error - Invalid User ID", func() {
		appConfig := &github.AppConfig{
			ID:            utils.ToPtr[int64](77777),
			ClientID:      utils.ToPtr("invalid-user-client-id"),
			ClientSecret:  utils.ToPtr("invalid-user-client-secret"),
			WebhookSecret: utils.ToPtr("invalid-user-webhook-secret"),
			PEM:           utils.ToPtr("invalid-user-private-key"),
			Name:          utils.ToPtr("Invalid User App"),
		}
		uniqueUUID := uuid.New()
		invalidUserID := uuid.New()

		app, err := suite.githubRepo.CreateApp(suite.Ctx, uniqueUUID, appConfig, invalidUserID)
		suite.Error(err)
		suite.Nil(app)
	})

	suite.Run("CreateApp Error when DB closed", func() {
		appConfig := &github.AppConfig{
			ID:            utils.ToPtr[int64](66666),
			ClientID:      utils.ToPtr("closed-db-client-id"),
			ClientSecret:  utils.ToPtr("closed-db-client-secret"),
			WebhookSecret: utils.ToPtr("closed-db-webhook-secret"),
			PEM:           utils.ToPtr("closed-db-private-key"),
			Name:          utils.ToPtr("Closed DB App"),
		}
		uniqueUUID := uuid.New()

		suite.DB.Close()
		app, err := suite.githubRepo.CreateApp(suite.Ctx, uniqueUUID, appConfig, suite.testUser.ID)
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
