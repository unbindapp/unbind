package oauth_repo

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/oauth2code"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	"golang.org/x/crypto/bcrypt"
)

type OAuth2CodeSuite struct {
	repository.RepositoryBaseSuite
	oauthRepo *OauthRepository
	testUser  *ent.User
}

func (suite *OAuth2CodeSuite) SetupTest() {
	suite.RepositoryBaseSuite.SetupTest()
	suite.oauthRepo = NewOauthRepository(suite.DB)

	// Create test user
	pwd, _ := bcrypt.GenerateFromPassword([]byte("test-password"), 1)
	suite.testUser = suite.DB.User.Create().
		SetEmail("test@example.com").
		SetPasswordHash(string(pwd)).
		SaveX(suite.Ctx)
}

func (suite *OAuth2CodeSuite) TearDownTest() {
	suite.RepositoryBaseSuite.TearDownTest()
	suite.oauthRepo = nil
	suite.testUser = nil
}

func (suite *OAuth2CodeSuite) TestCreateAuthCode() {
	code := "test-auth-code-123"
	clientID := "test-client-id"
	scope := "read write"
	expiresAt := time.Now().Add(10 * time.Minute)

	authCode, err := suite.oauthRepo.CreateAuthCode(suite.Ctx, code, clientID, scope, suite.testUser, expiresAt)
	suite.NoError(err)
	suite.NotNil(authCode)
	suite.Equal(code, authCode.AuthCode)
	suite.Equal(clientID, authCode.ClientID)
	suite.Equal(scope, authCode.Scope)
	suite.Equal(suite.testUser.ID, authCode.Edges.User.ID)
	suite.WithinDuration(expiresAt, authCode.ExpiresAt, time.Second)
	suite.NotEqual(uuid.Nil, authCode.ID)

	// Verify it was saved to database
	saved := suite.DB.Oauth2Code.Query().
		Where(oauth2code.ID(authCode.ID)).
		WithUser().
		OnlyX(suite.Ctx)
	suite.NoError(err)
	suite.Equal(authCode.AuthCode, saved.AuthCode)
	suite.Equal(authCode.ClientID, saved.ClientID)
	suite.Equal(authCode.Scope, saved.Scope)
	suite.Equal(authCode.Edges.User.ID, saved.Edges.User.ID)
}

func (suite *OAuth2CodeSuite) TestCreateAuthCodeDifferentScopes() {
	// Test with various scope formats
	testCases := []struct {
		name  string
		scope string
	}{
		{"single scope", "read"},
		{"multiple scopes", "read write admin"},
		{"empty scope", ""},
		{"scope with special chars", "user:read repo:write"},
	}

	for i, tc := range testCases {
		code := "test-code-" + tc.name
		clientID := "client-" + tc.name
		expiresAt := time.Now().Add(10 * time.Minute)

		authCode, err := suite.oauthRepo.CreateAuthCode(suite.Ctx, code, clientID, tc.scope, suite.testUser, expiresAt)
		suite.NoError(err, "Test case: %s", tc.name)
		suite.Equal(tc.scope, authCode.Scope, "Test case: %s", tc.name)
		suite.Equal(code, authCode.AuthCode, "Test case: %s", tc.name)

		// Clean up for next iteration (since SetupTest/TearDownTest don't run between iterations)
		if i < len(testCases)-1 {
			suite.DB.Oauth2Code.DeleteOneID(authCode.ID).ExecX(suite.Ctx)
		}
	}
}

func (suite *OAuth2CodeSuite) TestCreateAuthCodeExpiredTime() {
	code := "expired-code"
	clientID := "test-client"
	scope := "read"
	expiresAt := time.Now().Add(-5 * time.Minute) // Already expired

	authCode, err := suite.oauthRepo.CreateAuthCode(suite.Ctx, code, clientID, scope, suite.testUser, expiresAt)
	suite.NoError(err)
	suite.NotNil(authCode)
	suite.True(authCode.ExpiresAt.Before(time.Now()))
}

func (suite *OAuth2CodeSuite) TestCreateAuthCodeDBClosed() {
	suite.DB.Close()

	code := "test-code"
	clientID := "test-client"
	scope := "read"
	expiresAt := time.Now().Add(10 * time.Minute)

	authCode, err := suite.oauthRepo.CreateAuthCode(suite.Ctx, code, clientID, scope, suite.testUser, expiresAt)
	suite.Error(err)
	suite.Nil(authCode)
	suite.ErrorContains(err, "database is closed")
}

func (suite *OAuth2CodeSuite) TestGetAuthCode() {
	// First create an auth code
	code := "get-test-code"
	clientID := "get-test-client"
	scope := "read write"
	expiresAt := time.Now().Add(10 * time.Minute)

	created, err := suite.oauthRepo.CreateAuthCode(suite.Ctx, code, clientID, scope, suite.testUser, expiresAt)
	suite.NoError(err)

	// Now retrieve it
	retrieved, err := suite.oauthRepo.GetAuthCode(suite.Ctx, code)
	suite.NoError(err)
	suite.NotNil(retrieved)
	suite.Equal(created.ID, retrieved.ID)
	suite.Equal(code, retrieved.AuthCode)
	suite.Equal(clientID, retrieved.ClientID)
	suite.Equal(scope, retrieved.Scope)
	suite.Equal(suite.testUser.ID, retrieved.Edges.User.ID)

	// User edge should be loaded
	suite.NotNil(retrieved.Edges.User)
	suite.Equal(suite.testUser.ID, retrieved.Edges.User.ID)
	suite.Equal(suite.testUser.Email, retrieved.Edges.User.Email)
}

func (suite *OAuth2CodeSuite) TestGetAuthCodeNotFound() {
	nonExistentCode := "non-existent-code"

	retrieved, err := suite.oauthRepo.GetAuthCode(suite.Ctx, nonExistentCode)
	suite.Error(err)
	suite.Nil(retrieved)
}

func (suite *OAuth2CodeSuite) TestGetAuthCodeDBClosed() {
	// First create an auth code
	code := "db-closed-test-code"
	clientID := "test-client"
	scope := "read"
	expiresAt := time.Now().Add(10 * time.Minute)

	suite.oauthRepo.CreateAuthCode(suite.Ctx, code, clientID, scope, suite.testUser, expiresAt)

	// Close DB and try to retrieve
	suite.DB.Close()

	retrieved, err := suite.oauthRepo.GetAuthCode(suite.Ctx, code)
	suite.Error(err)
	suite.Nil(retrieved)
	suite.ErrorContains(err, "database is closed")
}

func (suite *OAuth2CodeSuite) TestDeleteAuthCode() {
	// First create an auth code
	code := "delete-test-code"
	clientID := "delete-test-client"
	scope := "read"
	expiresAt := time.Now().Add(10 * time.Minute)

	created, err := suite.oauthRepo.CreateAuthCode(suite.Ctx, code, clientID, scope, suite.testUser, expiresAt)
	suite.NoError(err)

	// Verify it exists
	retrieved, err := suite.oauthRepo.GetAuthCode(suite.Ctx, code)
	suite.NoError(err)
	suite.NotNil(retrieved)

	// Delete it
	err = suite.oauthRepo.DeleteAuthCode(suite.Ctx, code)
	suite.NoError(err)

	// Verify it's gone
	_, err = suite.oauthRepo.GetAuthCode(suite.Ctx, code)
	suite.Error(err)

	// Also verify by direct DB query
	_, err = suite.DB.Oauth2Code.Get(suite.Ctx, created.ID)
	suite.Error(err)
}

func (suite *OAuth2CodeSuite) TestDeleteAuthCodeNotFound() {
	nonExistentCode := "non-existent-delete-code"

	// Should not error when deleting non-existent code
	err := suite.oauthRepo.DeleteAuthCode(suite.Ctx, nonExistentCode)
	suite.NoError(err)
}

func (suite *OAuth2CodeSuite) TestDeleteAuthCodeMultipleCodes() {
	// Create multiple auth codes
	codes := []string{"code1", "code2", "code3"}
	clientID := "multi-test-client"
	scope := "read"
	expiresAt := time.Now().Add(10 * time.Minute)

	for _, code := range codes {
		_, err := suite.oauthRepo.CreateAuthCode(suite.Ctx, code, clientID, scope, suite.testUser, expiresAt)
		suite.NoError(err)
	}

	// Delete middle code
	err := suite.oauthRepo.DeleteAuthCode(suite.Ctx, "code2")
	suite.NoError(err)

	// Verify code2 is gone but others remain
	_, err = suite.oauthRepo.GetAuthCode(suite.Ctx, "code2")
	suite.Error(err)

	_, err = suite.oauthRepo.GetAuthCode(suite.Ctx, "code1")
	suite.NoError(err)

	_, err = suite.oauthRepo.GetAuthCode(suite.Ctx, "code3")
	suite.NoError(err)
}

func (suite *OAuth2CodeSuite) TestDeleteAuthCodeDBClosed() {
	// First create an auth code
	code := "db-closed-delete-code"
	clientID := "test-client"
	scope := "read"
	expiresAt := time.Now().Add(10 * time.Minute)

	suite.oauthRepo.CreateAuthCode(suite.Ctx, code, clientID, scope, suite.testUser, expiresAt)

	// Close DB and try to delete
	suite.DB.Close()

	err := suite.oauthRepo.DeleteAuthCode(suite.Ctx, code)
	suite.Error(err)
	suite.ErrorContains(err, "database is closed")
}

func (suite *OAuth2CodeSuite) TestAuthCodeLifecycle() {
	// Test complete lifecycle: create -> get -> delete -> verify gone
	code := "lifecycle-test-code"
	clientID := "lifecycle-client"
	scope := "read write admin"
	expiresAt := time.Now().Add(15 * time.Minute)

	// Create
	created, err := suite.oauthRepo.CreateAuthCode(suite.Ctx, code, clientID, scope, suite.testUser, expiresAt)
	suite.NoError(err)
	suite.NotNil(created)

	// Get and verify
	retrieved, err := suite.oauthRepo.GetAuthCode(suite.Ctx, code)
	suite.NoError(err)
	suite.Equal(created.ID, retrieved.ID)
	suite.Equal(created.AuthCode, retrieved.AuthCode)
	suite.NotNil(retrieved.Edges.User)

	// Delete
	err = suite.oauthRepo.DeleteAuthCode(suite.Ctx, code)
	suite.NoError(err)

	// Verify gone
	_, err = suite.oauthRepo.GetAuthCode(suite.Ctx, code)
	suite.Error(err)
}

func TestOAuth2CodeSuite(t *testing.T) {
	suite.Run(t, new(OAuth2CodeSuite))
}
