package apikey_service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/auth"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/models"
	apikey_repo "github.com/unbindapp/unbind-api/internal/repositories/apikey"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
	"github.com/unbindapp/unbind-api/internal/services"
)

type APIKeyServiceSuite struct {
	services.ServiceTestSuite
	service   *APIKeyService
	requester uuid.UUID
	projectID uuid.UUID
}

func (suite *APIKeyServiceSuite) SetupTest() {
	suite.ServiceTestSuite.SetupTest()
	suite.service = NewAPIKeyService(suite.MockRepo)
	suite.requester = uuid.New()
	suite.projectID = uuid.New()
}

func (suite *APIKeyServiceSuite) project() schema.APIKeyResource {
	return schema.APIKeyResource{ResourceType: schema.ResourceTypeProject, ResourceID: suite.projectID}
}

func (suite *APIKeyServiceSuite) expectCheck(check permissions_repo.PermissionCheck, result error) {
	suite.MockPermissionsRepo.EXPECT().
		Check(suite.Ctx, suite.requester, []permissions_repo.PermissionCheck{check}).
		Return(result).Once()
}

func (suite *APIKeyServiceSuite) expectCreate() *apikey_repo.CreateAPIKeyInput {
	stored := &apikey_repo.CreateAPIKeyInput{}
	suite.MockAPIKeyRepo.EXPECT().
		Create(suite.Ctx, mock.AnythingOfType("*apikey_repo.CreateAPIKeyInput")).
		RunAndReturn(func(_ context.Context, input *apikey_repo.CreateAPIKeyInput) (*ent.APIKey, error) {
			*stored = *input
			return &ent.APIKey{ID: uuid.New(), UserID: input.UserID, Name: input.Name, TokenPrefix: input.TokenPrefix, TokenHash: input.TokenHash, Role: input.Role, FullAccess: input.FullAccess, Resources: input.Resources}, nil
		}).Once()
	return stored
}

func (suite *APIKeyServiceSuite) TestCreateStoresHashAndReturnsTokenOnce() {
	suite.expectCheck(permissions_repo.PermissionCheck{Action: schema.ActionViewer, ResourceType: schema.ResourceTypeProject, ResourceID: suite.projectID}, nil)
	stored := suite.expectCreate()

	resp, err := suite.service.Create(suite.Ctx, suite.requester, &models.APIKeyCreateInput{Name: "ci", Role: schema.ActionViewer, Resources: []schema.APIKeyResource{suite.project()}})
	suite.Require().NoError(err)

	suite.True(auth.IsAPIKey(resp.Token))
	suite.Equal(auth.HashAPIKey(resp.Token), stored.TokenHash, "only the hash is persisted")
	suite.Equal(suite.requester, stored.UserID, "keys are always minted for the requester")
	suite.Equal(resp.TokenPrefix, stored.TokenPrefix)
	suite.NotContains(resp.TokenPrefix, resp.Token[len(resp.TokenPrefix):])
	suite.Equal(schema.ActionViewer, stored.Role)
	suite.False(stored.FullAccess)
	suite.Equal([]schema.APIKeyResource{suite.project()}, stored.Resources)
	suite.Equal([]schema.APIKeyResource{suite.project()}, resp.Resources)
}

func (suite *APIKeyServiceSuite) TestCreateChecksEveryResourceAtTheKeyRole() {
	envID := uuid.New()
	suite.expectCheck(permissions_repo.PermissionCheck{Action: schema.ActionEditor, ResourceType: schema.ResourceTypeProject, ResourceID: suite.projectID}, nil)
	suite.expectCheck(permissions_repo.PermissionCheck{Action: schema.ActionEditor, ResourceType: schema.ResourceTypeEnvironment, ResourceID: envID}, errdefs.ErrUnauthorized)

	_, err := suite.service.Create(suite.Ctx, suite.requester, &models.APIKeyCreateInput{Name: "ci", Role: schema.ActionEditor, Resources: []schema.APIKeyResource{
		suite.project(),
		{ResourceType: schema.ResourceTypeEnvironment, ResourceID: envID},
	}})
	suite.ErrorIs(err, errdefs.ErrInvalidInput)
	suite.Contains(err.Error(), "you do not have editor access to environment "+envID.String())
}

func (suite *APIKeyServiceSuite) TestCreateFullAccessNeedsNoCheck() {
	stored := suite.expectCreate()

	resp, err := suite.service.Create(suite.Ctx, suite.requester, &models.APIKeyCreateInput{Name: "me", Role: schema.ActionAdmin, FullAccess: true, Resources: []schema.APIKeyResource{}})
	suite.Require().NoError(err)
	suite.True(stored.FullAccess)
	suite.Equal(schema.ActionAdmin, stored.Role)
	suite.NotNil(stored.Resources, "resources are stored as an empty list, never null")
	suite.Empty(resp.Resources)
}

func (suite *APIKeyServiceSuite) TestCreateRejectsMalformedInput() {
	past := time.Now().Add(-time.Minute)
	tests := map[string]*models.APIKeyCreateInput{
		"expiry in the past":         {Name: "ci", ExpiresAt: &past, Role: schema.ActionViewer, Resources: []schema.APIKeyResource{suite.project()}},
		"unknown role":               {Name: "ci", Role: "owner", Resources: []schema.APIKeyResource{suite.project()}},
		"full access with resources": {Name: "ci", Role: schema.ActionViewer, FullAccess: true, Resources: []schema.APIKeyResource{suite.project()}},
		"scoped without resources":   {Name: "ci", Role: schema.ActionViewer},
		"system resource":            {Name: "ci", Role: schema.ActionAdmin, Resources: []schema.APIKeyResource{{ResourceType: schema.ResourceTypeSystem, ResourceID: uuid.New()}}},
		"unknown resource type":      {Name: "ci", Role: schema.ActionViewer, Resources: []schema.APIKeyResource{{ResourceType: "cluster", ResourceID: uuid.New()}}},
		"resource without id":        {Name: "ci", Role: schema.ActionViewer, Resources: []schema.APIKeyResource{{ResourceType: schema.ResourceTypeProject}}},
		"duplicate resource":         {Name: "ci", Role: schema.ActionViewer, Resources: []schema.APIKeyResource{suite.project(), suite.project()}},
	}

	for name, input := range tests {
		suite.Run(name, func() {
			_, err := suite.service.Create(suite.Ctx, suite.requester, input)
			suite.ErrorIs(err, errdefs.ErrInvalidInput)
		})
	}
}

func (suite *APIKeyServiceSuite) TestListOwnKeys() {
	suite.MockAPIKeyRepo.EXPECT().ListByUser(suite.Ctx, suite.requester).Return([]*ent.APIKey{{ID: uuid.New(), UserID: suite.requester}}, nil).Once()

	keys, err := suite.service.List(suite.Ctx, suite.requester, &models.APIKeyListInput{})
	suite.NoError(err)
	suite.Len(keys, 1)
	suite.NotNil(keys[0].Resources)
}

func (suite *APIKeyServiceSuite) TestListOtherUserRequiresSystemAdmin() {
	other := uuid.New()
	adminCheck := permissions_repo.PermissionCheck{Action: schema.ActionAdmin, ResourceType: schema.ResourceTypeSystem}

	suite.expectCheck(adminCheck, errdefs.ErrUnauthorized)
	_, err := suite.service.List(suite.Ctx, suite.requester, &models.APIKeyListInput{UserID: other})
	suite.ErrorIs(err, errdefs.ErrUnauthorized)

	suite.expectCheck(adminCheck, nil)
	suite.MockAPIKeyRepo.EXPECT().ListByUser(suite.Ctx, other).Return(nil, nil).Once()
	keys, err := suite.service.List(suite.Ctx, suite.requester, &models.APIKeyListInput{UserID: other})
	suite.NoError(err)
	suite.Empty(keys)
}

func (suite *APIKeyServiceSuite) TestDeleteOwnKey() {
	id := uuid.New()
	suite.MockAPIKeyRepo.EXPECT().GetByID(suite.Ctx, id).Return(&ent.APIKey{ID: id, UserID: suite.requester}, nil).Once()
	suite.MockAPIKeyRepo.EXPECT().Delete(suite.Ctx, id).Return(nil).Once()

	suite.NoError(suite.service.Delete(suite.Ctx, suite.requester, id))
}

func (suite *APIKeyServiceSuite) TestDeleteOthersKeyMaskedUnlessSystemAdmin() {
	id := uuid.New()
	adminCheck := permissions_repo.PermissionCheck{Action: schema.ActionAdmin, ResourceType: schema.ResourceTypeSystem}
	key := &ent.APIKey{ID: id, UserID: uuid.New()}

	suite.MockAPIKeyRepo.EXPECT().GetByID(suite.Ctx, id).Return(key, nil).Once()
	suite.expectCheck(adminCheck, errdefs.ErrUnauthorized)
	err := suite.service.Delete(suite.Ctx, suite.requester, id)
	suite.ErrorIs(err, errdefs.ErrNotFound, "non-admins cannot tell someone else's key from a missing one")
	suite.False(errors.Is(err, errdefs.ErrUnauthorized))

	suite.MockAPIKeyRepo.EXPECT().GetByID(suite.Ctx, id).Return(key, nil).Once()
	suite.expectCheck(adminCheck, nil)
	suite.MockAPIKeyRepo.EXPECT().Delete(suite.Ctx, id).Return(nil).Once()
	suite.NoError(suite.service.Delete(suite.Ctx, suite.requester, id))
}

func (suite *APIKeyServiceSuite) TestDeleteMissingKey() {
	id := uuid.New()
	suite.MockAPIKeyRepo.EXPECT().GetByID(suite.Ctx, id).Return(nil, &ent.NotFoundError{}).Once()
	suite.ErrorIs(suite.service.Delete(suite.Ctx, suite.requester, id), errdefs.ErrNotFound)
}

func TestAPIKeyServiceSuite(t *testing.T) {
	suite.Run(t, new(APIKeyServiceSuite))
}
