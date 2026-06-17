package system_repo

import (
	"testing"

	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
)

type SettingsSuite struct {
	repository.RepositoryBaseSuite
	systemRepo *SystemRepository
}

func (suite *SettingsSuite) SetupTest() {
	suite.RepositoryBaseSuite.SetupTest()
	suite.systemRepo = NewSystemRepository(suite.DB)
}

func (suite *SettingsSuite) TearDownTest() {
	suite.RepositoryBaseSuite.TearDownTest()
	suite.systemRepo = nil
}

func (suite *SettingsSuite) TestGetSystemSettings() {
	suite.Run("Get Non-existent Settings", func() {
		_, err := suite.systemRepo.GetSystemSettings(suite.Ctx, nil)
		suite.Error(err)
		suite.True(ent.IsNotFound(err))
	})

	suite.Run("Get Existing Settings", func() {
		// Create settings
		created := suite.DB.SystemSetting.Create().
			SetWildcardBaseURL("example.com").
			SaveX(suite.Ctx)

		settings, err := suite.systemRepo.GetSystemSettings(suite.Ctx, nil)
		suite.NoError(err)
		suite.NotNil(settings)
		suite.Equal(created.ID, settings.ID)
		suite.Equal("example.com", *settings.WildcardBaseURL)
	})

	suite.Run("Error when DB closed", func() {
		suite.DB.Close()
		_, err := suite.systemRepo.GetSystemSettings(suite.Ctx, nil)
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func (suite *SettingsSuite) TestUpdateSystemSettings() {
	suite.Run("Create New Settings", func() {
		// Clean up first
		suite.DB.SystemSetting.Delete().ExecX(suite.Ctx)

		input := &SystemSettingUpdateInput{
			WildcardDomain: utils.ToPtr("https://app.example.com"),
		}

		settings, err := suite.systemRepo.UpdateSystemSettings(suite.Ctx, input)
		suite.NoError(err)
		suite.NotNil(settings)
		suite.NotNil(settings.WildcardBaseURL)
		suite.Equal("app.example.com", *settings.WildcardBaseURL)
	})

	suite.Run("Update Existing Settings", func() {
		// Clean up first
		suite.DB.SystemSetting.Delete().ExecX(suite.Ctx)

		// Create initial settings
		existing := suite.DB.SystemSetting.Create().
			SetWildcardBaseURL("old.example.com").
			SaveX(suite.Ctx)

		input := &SystemSettingUpdateInput{
			WildcardDomain: utils.ToPtr("http://new.example.com"),
		}

		settings, err := suite.systemRepo.UpdateSystemSettings(suite.Ctx, input)
		suite.NoError(err)
		suite.NotNil(settings)
		suite.Equal(existing.ID, settings.ID)
		suite.Equal("new.example.com", *settings.WildcardBaseURL)
	})

	suite.Run("Clear Wildcard Domain", func() {
		// Clean up any existing settings first
		suite.DB.SystemSetting.Delete().ExecX(suite.Ctx)

		// Create settings with domain
		suite.DB.SystemSetting.Create().
			SetWildcardBaseURL("clear.example.com").
			SaveX(suite.Ctx)

		input := &SystemSettingUpdateInput{
			WildcardDomain: utils.ToPtr(""),
		}

		settings, err := suite.systemRepo.UpdateSystemSettings(suite.Ctx, input)
		suite.NoError(err)
		suite.NotNil(settings)
		suite.Nil(settings.WildcardBaseURL)
	})

	suite.Run("Update Buildkit Settings", func() {
		// Clean up any existing settings first
		suite.DB.SystemSetting.Delete().ExecX(suite.Ctx)

		buildkitSettings := &schema.BuildkitSettings{
			MaxParallelism: 30,
			Replicas:       2,
		}

		input := &SystemSettingUpdateInput{
			BuildkitSettings: buildkitSettings,
		}

		settings, err := suite.systemRepo.UpdateSystemSettings(suite.Ctx, input)
		suite.NoError(err)
		suite.NotNil(settings)
		suite.NotNil(settings.BuildkitSettings)
		suite.Equal(30, settings.BuildkitSettings.MaxParallelism)
		suite.Equal(2, settings.BuildkitSettings.Replicas)
	})

	suite.Run("Domain Prefix Stripping", func() {
		testCases := []struct {
			input    string
			expected string
		}{
			{"https://app.example.com", "app.example.com"},
			{"http://app.example.com", "app.example.com"},
			{"app.example.com", "app.example.com"},
		}

		for _, tc := range testCases {
			// Clean up for each test case
			suite.DB.SystemSetting.Delete().ExecX(suite.Ctx)

			input := &SystemSettingUpdateInput{
				WildcardDomain: utils.ToPtr(tc.input),
			}

			settings, err := suite.systemRepo.UpdateSystemSettings(suite.Ctx, input)
			suite.NoError(err)
			suite.Equal(tc.expected, *settings.WildcardBaseURL)
		}
	})

	suite.Run("Error when DB closed", func() {
		input := &SystemSettingUpdateInput{
			WildcardDomain: utils.ToPtr("test.example.com"),
		}

		suite.DB.Close()
		_, err := suite.systemRepo.UpdateSystemSettings(suite.Ctx, input)
		suite.Error(err)
		suite.ErrorContains(err, "database is closed")
	})
}

func TestSettingsSuite(t *testing.T) {
	suite.Run(t, new(SettingsSuite))
}
