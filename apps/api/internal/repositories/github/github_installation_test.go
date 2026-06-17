package github_repo

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/githubinstallation"
	"github.com/unbindapp/unbind-api/ent/schema"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	"golang.org/x/crypto/bcrypt"
)

type GithubInstallationSuite struct {
	repository.RepositoryBaseSuite
	githubRepo       *GithubRepository
	testUser         *ent.User
	testApp          *ent.GithubApp
	testInstallation *ent.GithubInstallation
}

func (suite *GithubInstallationSuite) SetupTest() {
	suite.RepositoryBaseSuite.SetupTest()
	suite.githubRepo = NewGithubRepository(suite.DB)

	// Create test user
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

	// Create test installation
	suite.testInstallation = suite.DB.GithubInstallation.Create().
		SetID(67890).
		SetGithubAppID(suite.testApp.ID).
		SetAccountID(11111).
		SetAccountLogin("test-org").
		SetAccountType(githubinstallation.AccountTypeOrganization).
		SetAccountURL("https://github.com/test-org").
		SetRepositorySelection(githubinstallation.RepositorySelectionSelected).
		SetSuspended(false).
		SetActive(true).
		SetPermissions(schema.GithubInstallationPermissions{
			Contents: "read",
			Metadata: "read",
		}).
		SetEvents([]string{"push", "pull_request"}).
		SaveX(suite.Ctx)
}

func (suite *GithubInstallationSuite) TearDownTest() {
	suite.RepositoryBaseSuite.TearDownTest()
	suite.githubRepo = nil
	suite.testUser = nil
	suite.testApp = nil
	suite.testInstallation = nil
}

func (suite *GithubInstallationSuite) TestGetInstallationByID() {
	suite.Run("GetInstallationByID Success", func() {
		installation, err := suite.githubRepo.GetInstallationByID(suite.Ctx, suite.testInstallation.ID)
		suite.NoError(err)
		suite.NotNil(installation)
		suite.Equal(suite.testInstallation.ID, installation.ID)
		suite.Equal("test-org", installation.AccountLogin)
		suite.Equal(githubinstallation.AccountTypeOrganization, installation.AccountType)
		suite.True(installation.Active)
		suite.False(installation.Suspended)
		// GithubApp edge should be loaded
		suite.NotNil(installation.Edges.GithubApp)
		suite.Equal(suite.testApp.ID, installation.Edges.GithubApp.ID)
	})

	suite.Run("GetInstallationByID Not Found", func() {
		nonExistentID := int64(99999)
		installation, err := suite.githubRepo.GetInstallationByID(suite.Ctx, nonExistentID)
		suite.Error(err)
		suite.Nil(installation)
	})

	suite.Run("GetInstallationByID Error when DB closed", func() {
		suite.DB.Close()
		installation, err := suite.githubRepo.GetInstallationByID(suite.Ctx, suite.testInstallation.ID)
		suite.Error(err)
		suite.Nil(installation)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *GithubInstallationSuite) TestGetInstallationsByCreator() {
	suite.Run("GetInstallationsByCreator Success", func() {
		installations, err := suite.githubRepo.GetInstallationsByCreator(suite.Ctx, suite.testUser.ID)
		suite.NoError(err)
		suite.Len(installations, 1)
		suite.Equal(suite.testInstallation.ID, installations[0].ID)
		// GithubApp edge should be loaded
		suite.NotNil(installations[0].Edges.GithubApp)
		suite.Equal(suite.testApp.ID, installations[0].Edges.GithubApp.ID)
	})

	suite.Run("GetInstallationsByCreator Multiple Installations", func() {
		// Create another app by the same user
		anotherApp := suite.DB.GithubApp.Create().
			SetID(54321).
			SetUUID(uuid.New()).
			SetClientID("another-client-id").
			SetClientSecret("another-client-secret").
			SetWebhookSecret("another-webhook-secret").
			SetPrivateKey("another-private-key").
			SetName("Another App").
			SetCreatedBy(suite.testUser.ID).
			SaveX(suite.Ctx)

		// Create installation for the other app
		anotherInstallation := suite.DB.GithubInstallation.Create().
			SetID(11111).
			SetGithubAppID(anotherApp.ID).
			SetAccountID(22222).
			SetAccountLogin("another-org").
			SetAccountType(githubinstallation.AccountTypeOrganization).
			SetAccountURL("https://github.com/another-org").
			SetRepositorySelection(githubinstallation.RepositorySelectionAll).
			SetSuspended(false).
			SetActive(true).
			SetPermissions(schema.GithubInstallationPermissions{
				Contents: "write",
			}).
			SetEvents([]string{"push"}).
			SaveX(suite.Ctx)

		installations, err := suite.githubRepo.GetInstallationsByCreator(suite.Ctx, suite.testUser.ID)
		suite.NoError(err)
		suite.Len(installations, 2)

		// Verify both installations are returned
		installationIDs := make([]int64, len(installations))
		for i, installation := range installations {
			installationIDs[i] = installation.ID
		}
		suite.Contains(installationIDs, suite.testInstallation.ID)
		suite.Contains(installationIDs, anotherInstallation.ID)
	})

	suite.Run("GetInstallationsByCreator Different Creator", func() {
		// Create another user
		pwd, _ := bcrypt.GenerateFromPassword([]byte("another-password"), 1)
		anotherUser := suite.DB.User.Create().
			SetEmail("another@example.com").
			SetPasswordHash(string(pwd)).
			SaveX(suite.Ctx)

		installations, err := suite.githubRepo.GetInstallationsByCreator(suite.Ctx, anotherUser.ID)
		suite.NoError(err)
		suite.Len(installations, 0)
	})

	suite.Run("GetInstallationsByCreator Non-existent Creator", func() {
		nonExistentUserID := uuid.New()
		installations, err := suite.githubRepo.GetInstallationsByCreator(suite.Ctx, nonExistentUserID)
		suite.NoError(err)
		suite.Len(installations, 0)
	})

	suite.Run("GetInstallationsByCreator Error when DB closed", func() {
		suite.DB.Close()
		installations, err := suite.githubRepo.GetInstallationsByCreator(suite.Ctx, suite.testUser.ID)
		suite.Error(err)
		suite.Nil(installations)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *GithubInstallationSuite) TestGetInstallationsByAppID() {
	suite.Run("GetInstallationsByAppID Success", func() {
		installations, err := suite.githubRepo.GetInstallationsByAppID(suite.Ctx, suite.testApp.ID)
		suite.NoError(err)
		suite.Len(installations, 1)
		suite.Equal(suite.testInstallation.ID, installations[0].ID)
		suite.Equal(suite.testApp.ID, installations[0].GithubAppID)
	})

	suite.Run("GetInstallationsByAppID Multiple Installations", func() {
		// Create another installation for the same app
		suite.DB.GithubInstallation.Create().
			SetID(33333).
			SetGithubAppID(suite.testApp.ID).
			SetAccountID(44444).
			SetAccountLogin("second-org").
			SetAccountType(githubinstallation.AccountTypeOrganization).
			SetAccountURL("https://github.com/second-org").
			SetRepositorySelection(githubinstallation.RepositorySelectionAll).
			SetSuspended(true).
			SetActive(false).
			SetPermissions(schema.GithubInstallationPermissions{
				Contents: "write",
			}).
			SetEvents([]string{"issues"}).
			SaveX(suite.Ctx)

		installations, err := suite.githubRepo.GetInstallationsByAppID(suite.Ctx, suite.testApp.ID)
		suite.NoError(err)
		suite.Len(installations, 2)

		// Verify both installations belong to the same app
		for _, installation := range installations {
			suite.Equal(suite.testApp.ID, installation.GithubAppID)
		}
	})

	suite.Run("GetInstallationsByAppID No Installations", func() {
		// Create another app with no installations
		anotherApp := suite.DB.GithubApp.Create().
			SetID(98765).
			SetUUID(uuid.New()).
			SetClientID("empty-client-id").
			SetClientSecret("empty-client-secret").
			SetWebhookSecret("empty-webhook-secret").
			SetPrivateKey("empty-private-key").
			SetName("Empty App").
			SetCreatedBy(suite.testUser.ID).
			SaveX(suite.Ctx)

		installations, err := suite.githubRepo.GetInstallationsByAppID(suite.Ctx, anotherApp.ID)
		suite.NoError(err)
		suite.Len(installations, 0)
	})

	suite.Run("GetInstallationsByAppID Non-existent App", func() {
		nonExistentAppID := int64(99999)
		installations, err := suite.githubRepo.GetInstallationsByAppID(suite.Ctx, nonExistentAppID)
		suite.NoError(err)
		suite.Len(installations, 0)
	})

	suite.Run("GetInstallationsByAppID Error when DB closed", func() {
		suite.DB.Close()
		installations, err := suite.githubRepo.GetInstallationsByAppID(suite.Ctx, suite.testApp.ID)
		suite.Error(err)
		suite.Nil(installations)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *GithubInstallationSuite) TestUpsertInstallation() {
	suite.Run("UpsertInstallation Create New", func() {
		permissions := schema.GithubInstallationPermissions{
			Contents: "write",
			Metadata: "read",
		}
		events := []string{"push", "pull_request", "issues"}

		installation, err := suite.githubRepo.UpsertInstallation(
			suite.Ctx,
			77777,
			suite.testApp.ID,
			55555,
			"new-org",
			githubinstallation.AccountTypeOrganization,
			"https://github.com/new-org",
			githubinstallation.RepositorySelectionAll,
			false,
			true,
			permissions,
			events,
		)
		suite.NoError(err)
		suite.NotNil(installation)
		suite.Equal(int64(77777), installation.ID)
		suite.Equal(suite.testApp.ID, installation.GithubAppID)
		suite.Equal(int64(55555), installation.AccountID)
		suite.Equal("new-org", installation.AccountLogin)
		suite.Equal(githubinstallation.AccountTypeOrganization, installation.AccountType)
		suite.Equal("https://github.com/new-org", installation.AccountURL)
		suite.Equal(githubinstallation.RepositorySelectionAll, installation.RepositorySelection)
		suite.False(installation.Suspended)
		suite.True(installation.Active)
		suite.Equal(permissions, installation.Permissions)
		suite.Equal(events, installation.Events)
	})

	suite.Run("UpsertInstallation Update Existing", func() {
		newPermissions := schema.GithubInstallationPermissions{
			Contents: "admin",
		}
		newEvents := []string{"push", "pull_request", "issues", "release"}

		installation, err := suite.githubRepo.UpsertInstallation(
			suite.Ctx,
			suite.testInstallation.ID, // Same ID as existing installation
			suite.testApp.ID,
			66666, // Updated account ID
			"updated-org",
			githubinstallation.AccountTypeUser,
			"https://github.com/updated-org",
			githubinstallation.RepositorySelectionAll,
			true,
			false,
			newPermissions,
			newEvents,
		)
		suite.NoError(err)
		suite.NotNil(installation)
		suite.Equal(suite.testInstallation.ID, installation.ID)
		suite.Equal(int64(66666), installation.AccountID)
		suite.Equal("updated-org", installation.AccountLogin)
		suite.Equal(githubinstallation.AccountTypeUser, installation.AccountType)
		suite.Equal("https://github.com/updated-org", installation.AccountURL)
		suite.Equal(githubinstallation.RepositorySelectionAll, installation.RepositorySelection)
		suite.True(installation.Suspended)
		suite.False(installation.Active)
		suite.Equal(newPermissions, installation.Permissions)
		suite.Equal(newEvents, installation.Events)
	})

	suite.Run("UpsertInstallation Error - Invalid App ID", func() {
		permissions := schema.GithubInstallationPermissions{
			Contents: "read",
		}
		nonExistentAppID := int64(99999)

		installation, err := suite.githubRepo.UpsertInstallation(
			suite.Ctx,
			88888,
			nonExistentAppID,
			11111,
			"invalid-app-org",
			githubinstallation.AccountTypeOrganization,
			"https://github.com/invalid-app-org",
			githubinstallation.RepositorySelectionSelected,
			false,
			true,
			permissions,
			[]string{"push"},
		)
		suite.Error(err)
		suite.Nil(installation)
	})

	suite.Run("UpsertInstallation Error when DB closed", func() {
		permissions := schema.GithubInstallationPermissions{
			Contents: "read",
		}

		suite.DB.Close()
		installation, err := suite.githubRepo.UpsertInstallation(
			suite.Ctx,
			99999,
			suite.testApp.ID,
			11111,
			"closed-db-org",
			githubinstallation.AccountTypeOrganization,
			"https://github.com/closed-db-org",
			githubinstallation.RepositorySelectionSelected,
			false,
			true,
			permissions,
			[]string{"push"},
		)
		suite.Error(err)
		suite.Nil(installation)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *GithubInstallationSuite) TestSetInstallationActive() {
	suite.Run("SetInstallationActive True", func() {
		// First set to false
		suite.DB.GithubInstallation.UpdateOneID(suite.testInstallation.ID).
			SetActive(false).
			SaveX(suite.Ctx)

		installation, err := suite.githubRepo.SetInstallationActive(suite.Ctx, suite.testInstallation.ID, true)
		suite.NoError(err)
		suite.NotNil(installation)
		suite.Equal(suite.testInstallation.ID, installation.ID)
		suite.True(installation.Active)
	})

	suite.Run("SetInstallationActive False", func() {
		installation, err := suite.githubRepo.SetInstallationActive(suite.Ctx, suite.testInstallation.ID, false)
		suite.NoError(err)
		suite.NotNil(installation)
		suite.Equal(suite.testInstallation.ID, installation.ID)
		suite.False(installation.Active)
	})

	suite.Run("SetInstallationActive Non-existent Installation", func() {
		nonExistentID := int64(99999)
		installation, err := suite.githubRepo.SetInstallationActive(suite.Ctx, nonExistentID, true)
		suite.Error(err)
		suite.Nil(installation)
	})

	suite.Run("SetInstallationActive Error when DB closed", func() {
		suite.DB.Close()
		installation, err := suite.githubRepo.SetInstallationActive(suite.Ctx, suite.testInstallation.ID, true)
		suite.Error(err)
		suite.Nil(installation)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *GithubInstallationSuite) TestSetInstallationSuspended() {
	suite.Run("SetInstallationSuspended True", func() {
		installation, err := suite.githubRepo.SetInstallationSuspended(suite.Ctx, suite.testInstallation.ID, true)
		suite.NoError(err)
		suite.NotNil(installation)
		suite.Equal(suite.testInstallation.ID, installation.ID)
		suite.True(installation.Suspended)
	})

	suite.Run("SetInstallationSuspended False", func() {
		installation, err := suite.githubRepo.SetInstallationSuspended(suite.Ctx, suite.testInstallation.ID, false)
		suite.NoError(err)
		suite.NotNil(installation)
		suite.Equal(suite.testInstallation.ID, installation.ID)
		suite.False(installation.Suspended)
	})

	suite.Run("SetInstallationSuspended Non-existent Installation", func() {
		nonExistentID := int64(99999)
		installation, err := suite.githubRepo.SetInstallationSuspended(suite.Ctx, nonExistentID, true)
		suite.Error(err)
		suite.Nil(installation)
	})

	suite.Run("SetInstallationSuspended Error when DB closed", func() {
		suite.DB.Close()
		installation, err := suite.githubRepo.SetInstallationSuspended(suite.Ctx, suite.testInstallation.ID, true)
		suite.Error(err)
		suite.Nil(installation)
		suite.ErrorContains(err, "database is closed")
	})
}

func TestGithubInstallationSuite(t *testing.T) {
	suite.Run(t, new(GithubInstallationSuite))
}
