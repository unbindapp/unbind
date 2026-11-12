package system_service

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/config"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/infrastructure/buildkitd"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
	"github.com/unbindapp/unbind-api/internal/services"
	"k8s.io/client-go/kubernetes/fake"
)

type SettingsSuite struct {
	services.ServiceTestSuite
	service *SystemService
}

func (suite *SettingsSuite) SetupTest() {
	suite.ServiceTestSuite.SetupTest()
	cfg := &config.Config{SystemNamespace: "unbind-system"}
	suite.service = &SystemService{
		cfg:             cfg,
		repo:            suite.MockRepo,
		buildkitManager: buildkitd.NewBuildkitSettingsManager(cfg, suite.MockRepo, suite.MockK8s),
		k8s:             suite.MockK8s,
	}
}

func (suite *SettingsSuite) TearDownTest() {
	suite.ServiceTestSuite.TearDownTest()
}

func (suite *SettingsSuite) TestGetSettingsNeedsNoSystemRole() {
	wildcard := "apps.example.com"
	suite.MockSystemRepo.EXPECT().GetSystemSettings(suite.Ctx, nil).Return(&ent.SystemSetting{WildcardBaseURL: &wildcard}, nil).Once()
	suite.MockK8s.EXPECT().GetInternalClient().Return(fake.NewClientset()).Once()

	settings, err := suite.service.GetSettings(suite.Ctx)
	suite.Require().NoError(err)
	suite.Equal(wildcard, *settings.WildcardDomain)
	suite.False(settings.CanUpdateBuildkit)
}

func (suite *SettingsSuite) TestUpdateSettingsNeedsSystemEditor() {
	memberID := uuid.New()
	suite.MockPermissionsRepo.EXPECT().
		Check(suite.Ctx, memberID, []permissions_repo.PermissionCheck{{Action: schema.ActionEditor, ResourceType: schema.ResourceTypeSystem}}).
		Return(errdefs.ErrUnauthorized).Once()

	wildcard := "apps.example.com"
	_, err := suite.service.UpdateSettings(suite.Ctx, memberID, &SystemSettingsUpdateInput{WildcardDomain: &wildcard})
	suite.ErrorIs(err, errdefs.ErrUnauthorized)
}

func TestSettingsSuite(t *testing.T) {
	suite.Run(t, new(SettingsSuite))
}
