package apikey_repo

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	repository "github.com/unbindapp/unbind-api/internal/repositories/repositorytest"
)

type APIKeyRepositorySuite struct {
	repository.RepositoryBaseSuite
	repo  *APIKeyRepository
	user  *ent.User
	other *ent.User
}

func (suite *APIKeyRepositorySuite) SetupTest() {
	suite.RepositoryBaseSuite.SetupTest()
	suite.repo = NewAPIKeyRepository(suite.DB)
	suite.user = suite.DB.User.Create().SetEmail("owner@example.com").SetPasswordHash("x").SaveX(suite.Ctx)
	suite.other = suite.DB.User.Create().SetEmail("other@example.com").SetPasswordHash("x").SaveX(suite.Ctx)
}

func (suite *APIKeyRepositorySuite) create(userID uuid.UUID, hash string, expiresAt *time.Time) *ent.APIKey {
	key, err := suite.repo.Create(suite.Ctx, &CreateAPIKeyInput{
		UserID:      userID,
		Name:        "ci-" + hash,
		TokenPrefix: "unb_abcdefgh",
		TokenHash:   hash,
		Role:        schema.ActionViewer,
		FullAccess:  true,
		Resources:   []schema.APIKeyResource{},
		ExpiresAt:   expiresAt,
	})
	suite.Require().NoError(err)
	return key
}

func (suite *APIKeyRepositorySuite) TestCreateAndLookup() {
	expires := time.Now().Add(time.Hour).UTC().Truncate(time.Second)
	created := suite.create(suite.user.ID, "hash-1", &expires)

	found, err := suite.repo.GetByTokenHash(suite.Ctx, "hash-1")
	suite.NoError(err)
	suite.Equal(created.ID, found.ID)
	suite.Require().NotNil(found.Edges.User)
	suite.Equal(suite.user.ID, found.Edges.User.ID)
	suite.Require().NotNil(found.ExpiresAt)
	suite.True(expires.Equal(*found.ExpiresAt))
	suite.Nil(found.LastUsedAt)
	suite.Equal(schema.ActionViewer, found.Role)
	suite.True(found.FullAccess)
	suite.Empty(found.Resources)

	_, err = suite.repo.GetByTokenHash(suite.Ctx, "missing")
	suite.True(ent.IsNotFound(err))

	byID, err := suite.repo.GetByID(suite.Ctx, created.ID)
	suite.NoError(err)
	suite.Equal(suite.user.ID, byID.UserID)
}

func (suite *APIKeyRepositorySuite) TestTokenHashIsUnique() {
	suite.create(suite.user.ID, "dup", nil)
	_, err := suite.repo.Create(suite.Ctx, &CreateAPIKeyInput{
		UserID: suite.other.ID, Name: "x", TokenPrefix: "unb_", TokenHash: "dup", Role: schema.ActionViewer, Resources: []schema.APIKeyResource{},
	})
	suite.True(ent.IsConstraintError(err))
}

func (suite *APIKeyRepositorySuite) TestListByUserIsOwnerScoped() {
	suite.create(suite.user.ID, "a", nil)
	suite.create(suite.user.ID, "b", nil)
	suite.create(suite.other.ID, "c", nil)

	mine, err := suite.repo.ListByUser(suite.Ctx, suite.user.ID)
	suite.NoError(err)
	suite.Len(mine, 2)
	for _, key := range mine {
		suite.Equal(suite.user.ID, key.UserID)
	}

	theirs, err := suite.repo.ListByUser(suite.Ctx, suite.other.ID)
	suite.NoError(err)
	suite.Len(theirs, 1)
}

func (suite *APIKeyRepositorySuite) TestDelete() {
	key := suite.create(suite.user.ID, "a", nil)
	suite.NoError(suite.repo.Delete(suite.Ctx, key.ID))
	_, err := suite.repo.GetByID(suite.Ctx, key.ID)
	suite.True(ent.IsNotFound(err))
	suite.True(ent.IsNotFound(suite.repo.Delete(suite.Ctx, key.ID)))
}

func (suite *APIKeyRepositorySuite) TestDeletingUserCascades() {
	suite.create(suite.user.ID, "a", nil)
	suite.DB.User.DeleteOneID(suite.user.ID).ExecX(suite.Ctx)
	_, err := suite.repo.GetByTokenHash(suite.Ctx, "a")
	suite.True(ent.IsNotFound(err))
}

func (suite *APIKeyRepositorySuite) TestTouchLastUsedThrottles() {
	key := suite.create(suite.user.ID, "a", nil)
	first := time.Now().UTC().Truncate(time.Second)

	suite.NoError(suite.repo.TouchLastUsed(suite.Ctx, key.ID, first, time.Minute))
	got := suite.DB.APIKey.GetX(suite.Ctx, key.ID)
	suite.Require().NotNil(got.LastUsedAt)
	suite.True(first.Equal(*got.LastUsedAt))

	suite.NoError(suite.repo.TouchLastUsed(suite.Ctx, key.ID, first.Add(30*time.Second), time.Minute))
	got = suite.DB.APIKey.GetX(suite.Ctx, key.ID)
	suite.True(first.Equal(*got.LastUsedAt), "a touch inside the interval is skipped")

	later := first.Add(2 * time.Minute)
	suite.NoError(suite.repo.TouchLastUsed(suite.Ctx, key.ID, later, time.Minute))
	got = suite.DB.APIKey.GetX(suite.Ctx, key.ID)
	suite.True(later.Equal(*got.LastUsedAt))
}

func TestAPIKeyRepositorySuite(t *testing.T) {
	suite.Run(t, new(APIKeyRepositorySuite))
}
