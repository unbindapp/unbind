package oauthserver_repo

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	repository "github.com/unbindapp/unbind-api/internal/repositories/repositorytest"
)

type OAuthServerRepositorySuite struct {
	repository.RepositoryBaseSuite
	repo *OAuthServerRepository
	user *ent.User
}

func (suite *OAuthServerRepositorySuite) SetupTest() {
	suite.RepositoryBaseSuite.SetupTest()
	suite.repo = NewOAuthServerRepository(suite.DB)
	suite.user = suite.DB.User.Create().SetEmail("owner@example.com").SetPasswordHash("x").SaveX(suite.Ctx)
}

func (suite *OAuthServerRepositorySuite) grant(clientID string) *ent.OAuthGrant {
	grant, err := suite.repo.CreateGrant(suite.Ctx, &CreateGrantInput{
		UserID:      suite.user.ID,
		ClientID:    clientID,
		ClientName:  "Claude",
		ClientKind:  schema.OAuthClientKindDynamic,
		RedirectURI: "https://claude.ai/api/mcp/auth_callback",
		Role:        schema.ActionEditor,
		FullAccess:  true,
		Resources:   []schema.APIKeyResource{},
		Resource:    "https://unbind.example.com/mcp",
	})
	suite.Require().NoError(err)
	return grant
}

func (suite *OAuthServerRepositorySuite) tokens(grantID uuid.UUID, access, refresh string, expiresAt time.Time) {
	suite.Require().NoError(suite.repo.CreateTokens(suite.Ctx, &CreateTokensInput{
		GrantID:          grantID,
		AccessHash:       access,
		AccessExpiresAt:  expiresAt,
		RefreshHash:      refresh,
		RefreshExpiresAt: expiresAt.Add(time.Hour),
	}))
}

func (suite *OAuthServerRepositorySuite) TestClientLifecycle() {
	client, err := suite.repo.CreateClient(suite.Ctx, &CreateClientInput{
		ClientID:     "client-1",
		Name:         "Claude",
		RedirectURIs: []string{"https://claude.ai/api/mcp/auth_callback"},
	})
	suite.Require().NoError(err)

	found, err := suite.repo.GetClientByClientID(suite.Ctx, "client-1")
	suite.NoError(err)
	suite.Equal(client.ID, found.ID)
	suite.Equal([]string{"https://claude.ai/api/mcp/auth_callback"}, found.RedirectUris)
	suite.Nil(found.LastUsedAt)

	_, err = suite.repo.GetClientByClientID(suite.Ctx, "missing")
	suite.True(ent.IsNotFound(err))

	now := time.Now()
	suite.NoError(suite.repo.TouchClientLastUsed(suite.Ctx, client.ID, now, time.Minute))
	suite.NoError(suite.repo.TouchClientLastUsed(suite.Ctx, client.ID, now.Add(10*time.Second), time.Minute))
	found = suite.DB.OAuthClient.GetX(suite.Ctx, client.ID)
	suite.WithinDuration(now, *found.LastUsedAt, time.Second)
}

func (suite *OAuthServerRepositorySuite) TestOrphanClientPurgeKeepsGranted() {
	old := time.Now().Add(-48 * time.Hour)
	for _, id := range []string{"orphan", "granted"} {
		suite.DB.OAuthClient.Create().SetClientID(id).SetName(id).SetRedirectUris([]string{"https://a.com/cb"}).SetCreatedAt(old).ExecX(suite.Ctx)
	}
	_, err := suite.repo.CreateClient(suite.Ctx, &CreateClientInput{ClientID: "fresh", Name: "fresh", RedirectURIs: []string{"https://a.com/cb"}})
	suite.Require().NoError(err)
	suite.grant("granted")

	deleted, err := suite.repo.DeleteOrphanClientsBefore(suite.Ctx, time.Now().Add(-24*time.Hour))
	suite.NoError(err)
	suite.Equal(1, deleted)

	remaining := suite.DB.OAuthClient.Query().AllX(suite.Ctx)
	ids := []string{}
	for _, c := range remaining {
		ids = append(ids, c.ClientID)
	}
	suite.ElementsMatch([]string{"granted", "fresh"}, ids)
}

func (suite *OAuthServerRepositorySuite) TestCodeIsClaimedOnce() {
	code, err := suite.repo.CreateCode(suite.Ctx, &CreateCodeInput{
		UserID:        suite.user.ID,
		CodeHash:      "code-hash",
		ClientID:      "client-1",
		ClientName:    "Claude",
		ClientKind:    schema.OAuthClientKindMetadataDocument,
		RedirectURI:   "http://localhost:3118/callback",
		CodeChallenge: "challenge",
		Resource:      "https://unbind.example.com/mcp",
		Role:          schema.ActionViewer,
		Resources:     []schema.APIKeyResource{{ResourceType: schema.ResourceTypeTeam, ResourceID: uuid.New()}},
		ExpiresAt:     time.Now().Add(time.Minute),
	})
	suite.Require().NoError(err)

	found, err := suite.repo.GetCodeByHash(suite.Ctx, "code-hash")
	suite.NoError(err)
	suite.Equal(code.ID, found.ID)
	suite.Require().NotNil(found.Edges.User)
	suite.Equal(suite.user.ID, found.Edges.User.ID)
	suite.Len(found.Resources, 1)
	suite.Nil(found.UsedAt)

	grant := suite.grant("client-1")
	claimed, err := suite.repo.MarkCodeUsed(suite.Ctx, code.ID, time.Now(), grant.ID)
	suite.NoError(err)
	suite.True(claimed)

	claimed, err = suite.repo.MarkCodeUsed(suite.Ctx, code.ID, time.Now(), grant.ID)
	suite.NoError(err)
	suite.False(claimed)

	found, _ = suite.repo.GetCodeByHash(suite.Ctx, "code-hash")
	suite.Require().NotNil(found.GrantID)
	suite.Equal(grant.ID, *found.GrantID)
}

func (suite *OAuthServerRepositorySuite) TestTokensLoadGrantAndUser() {
	grant := suite.grant("client-1")
	suite.tokens(grant.ID, "access-hash", "refresh-hash", time.Now().Add(time.Hour))

	token, err := suite.repo.GetTokenByHash(suite.Ctx, "refresh-hash")
	suite.Require().NoError(err)
	suite.Equal(schema.OAuthTokenKindRefresh, token.Kind)
	suite.Require().NotNil(token.Edges.Grant)
	suite.Equal(grant.ID, token.Edges.Grant.ID)
	suite.Require().NotNil(token.Edges.Grant.Edges.User)
	suite.Equal(suite.user.ID, token.Edges.Grant.Edges.User.ID)

	retired, err := suite.repo.MarkTokenUsed(suite.Ctx, token.ID, time.Now())
	suite.NoError(err)
	suite.True(retired)
	retired, err = suite.repo.MarkTokenUsed(suite.Ctx, token.ID, time.Now())
	suite.NoError(err)
	suite.False(retired)

	suite.Error(suite.repo.CreateTokens(suite.Ctx, &CreateTokensInput{
		GrantID:          grant.ID,
		AccessHash:       "access-hash",
		AccessExpiresAt:  time.Now(),
		RefreshHash:      "new-refresh",
		RefreshExpiresAt: time.Now(),
	}))
	_, err = suite.repo.GetTokenByHash(suite.Ctx, "new-refresh")
	suite.True(ent.IsNotFound(err), "a failed pair must not leave half a pair behind")
}

func (suite *OAuthServerRepositorySuite) TestListGrantsExcludesRevoked() {
	first := suite.grant("client-1")
	second := suite.grant("client-2")
	suite.NoError(suite.repo.RevokeGrant(suite.Ctx, first.ID, time.Now()))

	grants, err := suite.repo.ListGrantsByUser(suite.Ctx, suite.user.ID)
	suite.NoError(err)
	suite.Require().Len(grants, 1)
	suite.Equal(second.ID, grants[0].ID)

	revoked, _ := suite.repo.GetGrantByID(suite.Ctx, first.ID)
	suite.NotNil(revoked.RevokedAt)
	suite.Require().NotNil(revoked.Edges.User)

	now := time.Now()
	suite.NoError(suite.repo.TouchGrantLastUsed(suite.Ctx, second.ID, now, time.Minute))
	touched, _ := suite.repo.GetGrantByID(suite.Ctx, second.ID)
	suite.WithinDuration(now, *touched.LastUsedAt, time.Second)
}

func (suite *OAuthServerRepositorySuite) TestCleanupDeletesOnlyDeadRows() {
	now := time.Now()
	grant := suite.grant("client-1")
	suite.tokens(grant.ID, "live-access", "live-refresh", now.Add(time.Hour))
	suite.tokens(grant.ID, "dead-access", "dead-refresh", now.Add(-48*time.Hour))
	retired, _ := suite.repo.GetTokenByHash(suite.Ctx, "live-refresh")
	suite.DB.OAuthGrantToken.UpdateOneID(retired.ID).SetUsedAt(now.Add(-48 * time.Hour)).ExecX(suite.Ctx)

	for hash, expires := range map[string]time.Time{"live-code": now.Add(time.Minute), "dead-code": now.Add(-time.Minute)} {
		_, err := suite.repo.CreateCode(suite.Ctx, &CreateCodeInput{
			UserID: suite.user.ID, CodeHash: hash, ClientID: "c", ClientName: "c", ClientKind: schema.OAuthClientKindDynamic,
			RedirectURI: "https://a.com/cb", CodeChallenge: "x", Resource: "r", Role: schema.ActionViewer,
			Resources: []schema.APIKeyResource{}, ExpiresAt: expires,
		})
		suite.Require().NoError(err)
	}

	deletedTokens, err := suite.repo.DeleteTokensExpiredOrUsedBefore(suite.Ctx, now.Add(-24*time.Hour))
	suite.NoError(err)
	suite.Equal(3, deletedTokens)
	deletedCodes, err := suite.repo.DeleteCodesExpiredBefore(suite.Ctx, now)
	suite.NoError(err)
	suite.Equal(1, deletedCodes)

	_, err = suite.repo.GetTokenByHash(suite.Ctx, "live-access")
	suite.NoError(err)
	_, err = suite.repo.GetCodeByHash(suite.Ctx, "live-code")
	suite.NoError(err)
}

func (suite *OAuthServerRepositorySuite) TestUserDeletionCascades() {
	grant := suite.grant("client-1")
	suite.tokens(grant.ID, "access-hash", "refresh-hash", time.Now().Add(time.Hour))
	_, err := suite.repo.CreateCode(suite.Ctx, &CreateCodeInput{
		UserID: suite.user.ID, CodeHash: "code", ClientID: "c", ClientName: "c", ClientKind: schema.OAuthClientKindDynamic,
		RedirectURI: "https://a.com/cb", CodeChallenge: "x", Resource: "r", Role: schema.ActionViewer,
		Resources: []schema.APIKeyResource{}, ExpiresAt: time.Now().Add(time.Minute),
	})
	suite.Require().NoError(err)

	suite.DB.User.DeleteOneID(suite.user.ID).ExecX(suite.Ctx)

	suite.Equal(0, suite.DB.OAuthGrant.Query().CountX(suite.Ctx))
	suite.Equal(0, suite.DB.OAuthGrantToken.Query().CountX(suite.Ctx))
	suite.Equal(0, suite.DB.OAuthAuthorizationCode.Query().CountX(suite.Ctx))
}

func TestOAuthServerRepositorySuite(t *testing.T) {
	suite.Run(t, new(OAuthServerRepositorySuite))
}
