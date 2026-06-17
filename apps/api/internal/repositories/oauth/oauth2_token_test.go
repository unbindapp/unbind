package oauth_repo

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	repository "github.com/unbindapp/unbind-api/internal/repositories/repositorytest"
	"golang.org/x/crypto/bcrypt"
)

type OAuth2TokenSuite struct {
	repository.RepositoryBaseSuite
	oauthRepo *OauthRepository
	testUser  *ent.User
}

func (suite *OAuth2TokenSuite) SetupTest() {
	suite.RepositoryBaseSuite.SetupTest()
	suite.oauthRepo = NewOauthRepository(suite.DB)

	// Create test user
	pwd, _ := bcrypt.GenerateFromPassword([]byte("test-password"), 1)
	suite.testUser = suite.DB.User.Create().
		SetEmail("test@example.com").
		SetPasswordHash(string(pwd)).
		SaveX(suite.Ctx)
}

func (suite *OAuth2TokenSuite) TearDownTest() {
	suite.RepositoryBaseSuite.TearDownTest()
	suite.oauthRepo = nil
	suite.testUser = nil
}

func (suite *OAuth2TokenSuite) TestCreateToken() {
	accessToken := "access-token-123"
	refreshToken := "refresh-token-456"
	clientID := "test-client-id"
	scope := "read write"
	expiresAt := time.Now().Add(1 * time.Hour)

	token, err := suite.oauthRepo.CreateToken(suite.Ctx, accessToken, refreshToken, clientID, scope, expiresAt, suite.testUser)
	suite.NoError(err)
	suite.NotNil(token)
	suite.Equal(accessToken, token.AccessToken)
	suite.Equal(refreshToken, token.RefreshToken)
	suite.Equal(clientID, token.ClientID)
	suite.Equal(scope, token.Scope)
	suite.Equal(suite.testUser.ID, token.Edges.User.ID)
	suite.WithinDuration(expiresAt, token.ExpiresAt, time.Second)
	suite.False(token.Revoked) // Should default to false
	suite.NotEqual(uuid.Nil, token.ID)
}

func (suite *OAuth2TokenSuite) TestCreateTokenDifferentScopes() {
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
		accessToken := "access-" + tc.name
		refreshToken := "refresh-" + tc.name
		clientID := "client-" + tc.name
		expiresAt := time.Now().Add(1 * time.Hour)

		token, err := suite.oauthRepo.CreateToken(suite.Ctx, accessToken, refreshToken, clientID, tc.scope, expiresAt, suite.testUser)
		suite.NoError(err, "Test case: %s", tc.name)
		suite.Equal(tc.scope, token.Scope, "Test case: %s", tc.name)

		// Clean up for next iteration
		if i < len(testCases)-1 {
			suite.DB.Oauth2Token.DeleteOneID(token.ID).ExecX(suite.Ctx)
		}
	}
}

func (suite *OAuth2TokenSuite) TestCreateTokenDBClosed() {
	suite.DB.Close()

	accessToken := "access-token"
	refreshToken := "refresh-token"
	clientID := "test-client"
	scope := "read"
	expiresAt := time.Now().Add(1 * time.Hour)

	token, err := suite.oauthRepo.CreateToken(suite.Ctx, accessToken, refreshToken, clientID, scope, expiresAt, suite.testUser)
	suite.Error(err)
	suite.Nil(token)
	suite.ErrorContains(err, "database is closed")
}

func (suite *OAuth2TokenSuite) TestGetByAccessToken() {
	// Create a token first
	accessToken := "get-access-token"
	refreshToken := "get-refresh-token"
	clientID := "get-client"
	scope := "read write"
	expiresAt := time.Now().Add(1 * time.Hour)

	created, err := suite.oauthRepo.CreateToken(suite.Ctx, accessToken, refreshToken, clientID, scope, expiresAt, suite.testUser)
	suite.NoError(err)

	// Retrieve by access token
	retrieved, err := suite.oauthRepo.GetByAccessToken(suite.Ctx, accessToken)
	suite.NoError(err)
	suite.NotNil(retrieved)
	suite.Equal(created.ID, retrieved.ID)
	suite.Equal(accessToken, retrieved.AccessToken)
	suite.Equal(refreshToken, retrieved.RefreshToken)
	suite.Equal(clientID, retrieved.ClientID)
	suite.Equal(scope, retrieved.Scope)
	suite.Equal(suite.testUser.ID, retrieved.Edges.User.ID)
}

func (suite *OAuth2TokenSuite) TestGetByAccessTokenNotFound() {
	nonExistentToken := "non-existent-access-token"

	retrieved, err := suite.oauthRepo.GetByAccessToken(suite.Ctx, nonExistentToken)
	suite.Error(err)
	suite.Nil(retrieved)
}

func (suite *OAuth2TokenSuite) TestGetByAccessTokenDBClosed() {
	// Create token first
	accessToken := "db-closed-access-token"
	refreshToken := "db-closed-refresh-token"
	clientID := "test-client"
	scope := "read"
	expiresAt := time.Now().Add(1 * time.Hour)

	suite.oauthRepo.CreateToken(suite.Ctx, accessToken, refreshToken, clientID, scope, expiresAt, suite.testUser)

	suite.DB.Close()

	retrieved, err := suite.oauthRepo.GetByAccessToken(suite.Ctx, accessToken)
	suite.Error(err)
	suite.Nil(retrieved)
	suite.ErrorContains(err, "database is closed")
}

func (suite *OAuth2TokenSuite) TestGetByRefreshToken() {
	// Create a token first
	accessToken := "refresh-get-access-token"
	refreshToken := "refresh-get-refresh-token"
	clientID := "refresh-get-client"
	scope := "read"
	expiresAt := time.Now().Add(1 * time.Hour)

	created, err := suite.oauthRepo.CreateToken(suite.Ctx, accessToken, refreshToken, clientID, scope, expiresAt, suite.testUser)
	suite.NoError(err)

	// Retrieve by refresh token
	retrieved, err := suite.oauthRepo.GetByRefreshToken(suite.Ctx, refreshToken)
	suite.NoError(err)
	suite.NotNil(retrieved)
	suite.Equal(created.ID, retrieved.ID)
	suite.Equal(accessToken, retrieved.AccessToken)
	suite.Equal(refreshToken, retrieved.RefreshToken)
	suite.Equal(clientID, retrieved.ClientID)
	suite.Equal(scope, retrieved.Scope)
	suite.Equal(suite.testUser.ID, retrieved.Edges.User.ID)
}

func (suite *OAuth2TokenSuite) TestGetByRefreshTokenNotFound() {
	nonExistentToken := "non-existent-refresh-token"

	retrieved, err := suite.oauthRepo.GetByRefreshToken(suite.Ctx, nonExistentToken)
	suite.Error(err)
	suite.Nil(retrieved)
}

func (suite *OAuth2TokenSuite) TestGetByRefreshTokenDBClosed() {
	// Create token first
	accessToken := "refresh-db-closed-access"
	refreshToken := "refresh-db-closed-refresh"
	clientID := "test-client"
	scope := "read"
	expiresAt := time.Now().Add(1 * time.Hour)

	suite.oauthRepo.CreateToken(suite.Ctx, accessToken, refreshToken, clientID, scope, expiresAt, suite.testUser)

	suite.DB.Close()

	retrieved, err := suite.oauthRepo.GetByRefreshToken(suite.Ctx, refreshToken)
	suite.Error(err)
	suite.Nil(retrieved)
	suite.ErrorContains(err, "database is closed")
}

func (suite *OAuth2TokenSuite) TestRevokeAccessToken() {
	// Create a token first
	accessToken := "revoke-access-token"
	refreshToken := "revoke-refresh-token"
	clientID := "revoke-client"
	scope := "read"
	expiresAt := time.Now().Add(1 * time.Hour)

	created, err := suite.oauthRepo.CreateToken(suite.Ctx, accessToken, refreshToken, clientID, scope, expiresAt, suite.testUser)
	suite.NoError(err)
	suite.False(created.Revoked)

	// Revoke the access token
	err = suite.oauthRepo.RevokeAccessToken(suite.Ctx, accessToken)
	suite.NoError(err)

	// Verify it's revoked
	updated, err := suite.DB.Oauth2Token.Get(suite.Ctx, created.ID)
	suite.NoError(err)
	suite.True(updated.Revoked)
}

func (suite *OAuth2TokenSuite) TestRevokeAccessTokenNotFound() {
	nonExistentToken := "non-existent-revoke-access"

	// Should not error when revoking non-existent token
	err := suite.oauthRepo.RevokeAccessToken(suite.Ctx, nonExistentToken)
	suite.NoError(err)
}

func (suite *OAuth2TokenSuite) TestRevokeAccessTokenDBClosed() {
	// Create token first
	accessToken := "revoke-db-closed-access"
	refreshToken := "revoke-db-closed-refresh"
	clientID := "test-client"
	scope := "read"
	expiresAt := time.Now().Add(1 * time.Hour)

	suite.oauthRepo.CreateToken(suite.Ctx, accessToken, refreshToken, clientID, scope, expiresAt, suite.testUser)

	suite.DB.Close()

	err := suite.oauthRepo.RevokeAccessToken(suite.Ctx, accessToken)
	suite.Error(err)
	suite.ErrorContains(err, "database is closed")
}

func (suite *OAuth2TokenSuite) TestRevokeRefreshToken() {
	// Create a token first
	accessToken := "refresh-revoke-access"
	refreshToken := "refresh-revoke-refresh"
	clientID := "refresh-revoke-client"
	scope := "read"
	expiresAt := time.Now().Add(1 * time.Hour)

	created, err := suite.oauthRepo.CreateToken(suite.Ctx, accessToken, refreshToken, clientID, scope, expiresAt, suite.testUser)
	suite.NoError(err)
	suite.False(created.Revoked)

	// Revoke the refresh token
	err = suite.oauthRepo.RevokeRefreshToken(suite.Ctx, refreshToken)
	suite.NoError(err)

	// Verify it's revoked
	updated, err := suite.DB.Oauth2Token.Get(suite.Ctx, created.ID)
	suite.NoError(err)
	suite.True(updated.Revoked)
}

func (suite *OAuth2TokenSuite) TestRevokeRefreshTokenNotFound() {
	nonExistentToken := "non-existent-revoke-refresh"

	// Should not error when revoking non-existent token
	err := suite.oauthRepo.RevokeRefreshToken(suite.Ctx, nonExistentToken)
	suite.NoError(err)
}

func (suite *OAuth2TokenSuite) TestRevokeRefreshTokenDBClosed() {
	// Create token first
	accessToken := "refresh-revoke-db-access"
	refreshToken := "refresh-revoke-db-refresh"
	clientID := "test-client"
	scope := "read"
	expiresAt := time.Now().Add(1 * time.Hour)

	suite.oauthRepo.CreateToken(suite.Ctx, accessToken, refreshToken, clientID, scope, expiresAt, suite.testUser)

	suite.DB.Close()

	err := suite.oauthRepo.RevokeRefreshToken(suite.Ctx, refreshToken)
	suite.Error(err)
	suite.ErrorContains(err, "database is closed")
}

func (suite *OAuth2TokenSuite) TestCleanTokenStore() {
	now := time.Now()

	// Create various tokens for cleanup testing
	// 1. Valid token (should not be cleaned)
	validToken, err := suite.oauthRepo.CreateToken(suite.Ctx, "valid-access", "valid-refresh", "client1", "read", now.Add(1*time.Hour), suite.testUser)
	suite.NoError(err)

	// 2. Expired token (should be cleaned)
	expiredToken, err := suite.oauthRepo.CreateToken(suite.Ctx, "expired-access", "expired-refresh", "client2", "read", now.Add(-1*time.Hour), suite.testUser)
	suite.NoError(err)

	// 3. Revoked token (should be cleaned)
	revokedToken, err := suite.oauthRepo.CreateToken(suite.Ctx, "revoked-access", "revoked-refresh", "client3", "read", now.Add(1*time.Hour), suite.testUser)
	suite.NoError(err)
	suite.DB.Oauth2Token.UpdateOneID(revokedToken.ID).SetRevoked(true).SaveX(suite.Ctx)

	// 4. Valid auth code (should not be cleaned)
	validCode, err := suite.oauthRepo.CreateAuthCode(suite.Ctx, "valid-code", "client4", "read", suite.testUser, now.Add(10*time.Minute))
	suite.NoError(err)

	// 5. Expired auth code (should be cleaned)
	expiredCode, err := suite.oauthRepo.CreateAuthCode(suite.Ctx, "expired-code", "client5", "read", suite.testUser, now.Add(-10*time.Minute))
	suite.NoError(err)

	// Run cleanup
	err = suite.oauthRepo.CleanTokenStore(suite.Ctx)
	suite.NoError(err)

	// Verify valid token still exists
	_, err = suite.DB.Oauth2Token.Get(suite.Ctx, validToken.ID)
	suite.NoError(err)

	// Verify expired token was cleaned
	_, err = suite.DB.Oauth2Token.Get(suite.Ctx, expiredToken.ID)
	suite.Error(err)

	// Verify revoked token was cleaned
	_, err = suite.DB.Oauth2Token.Get(suite.Ctx, revokedToken.ID)
	suite.Error(err)

	// Verify valid code still exists
	_, err = suite.DB.Oauth2Code.Get(suite.Ctx, validCode.ID)
	suite.NoError(err)

	// Verify expired code was cleaned
	_, err = suite.DB.Oauth2Code.Get(suite.Ctx, expiredCode.ID)
	suite.Error(err)
}

func (suite *OAuth2TokenSuite) TestCleanTokenStoreNoExpiredTokens() {
	now := time.Now()

	// Create only valid tokens and codes
	validToken, err := suite.oauthRepo.CreateToken(suite.Ctx, "valid-access", "valid-refresh", "client1", "read", now.Add(1*time.Hour), suite.testUser)
	suite.NoError(err)

	validCode, err := suite.oauthRepo.CreateAuthCode(suite.Ctx, "valid-code", "client2", "read", suite.testUser, now.Add(10*time.Minute))
	suite.NoError(err)

	// Run cleanup
	err = suite.oauthRepo.CleanTokenStore(suite.Ctx)
	suite.NoError(err)

	// Verify both still exist
	_, err = suite.DB.Oauth2Token.Get(suite.Ctx, validToken.ID)
	suite.NoError(err)

	_, err = suite.DB.Oauth2Code.Get(suite.Ctx, validCode.ID)
	suite.NoError(err)
}

func (suite *OAuth2TokenSuite) TestCleanTokenStoreDBClosed() {
	suite.DB.Close()

	err := suite.oauthRepo.CleanTokenStore(suite.Ctx)
	suite.Error(err)
	suite.ErrorContains(err, "database is closed")
}

func (suite *OAuth2TokenSuite) TestTokenLifecycle() {
	// Test complete lifecycle: create -> get -> revoke -> clean
	accessToken := "lifecycle-access"
	refreshToken := "lifecycle-refresh"
	clientID := "lifecycle-client"
	scope := "read write"
	expiresAt := time.Now().Add(1 * time.Hour)

	// Create
	created, err := suite.oauthRepo.CreateToken(suite.Ctx, accessToken, refreshToken, clientID, scope, expiresAt, suite.testUser)
	suite.NoError(err)
	suite.False(created.Revoked)

	// Get by access token
	byAccess, err := suite.oauthRepo.GetByAccessToken(suite.Ctx, accessToken)
	suite.NoError(err)
	suite.Equal(created.ID, byAccess.ID)

	// Get by refresh token
	byRefresh, err := suite.oauthRepo.GetByRefreshToken(suite.Ctx, refreshToken)
	suite.NoError(err)
	suite.Equal(created.ID, byRefresh.ID)

	// Revoke
	err = suite.oauthRepo.RevokeAccessToken(suite.Ctx, accessToken)
	suite.NoError(err)

	// Verify revoked
	updated, err := suite.DB.Oauth2Token.Get(suite.Ctx, created.ID)
	suite.NoError(err)
	suite.True(updated.Revoked)

	// Clean
	err = suite.oauthRepo.CleanTokenStore(suite.Ctx)
	suite.NoError(err)

	// Verify cleaned
	_, err = suite.DB.Oauth2Token.Get(suite.Ctx, created.ID)
	suite.Error(err)
}

func TestOAuth2TokenSuite(t *testing.T) {
	suite.Run(t, new(OAuth2TokenSuite))
}
