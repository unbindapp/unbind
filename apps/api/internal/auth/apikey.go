package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"strings"
	"time"

	"github.com/unbindapp/unbind-api/ent"
)

const (
	APIKeyPrefix            = "unb_"
	OAuthAccessTokenPrefix  = "unbat_"
	OAuthRefreshTokenPrefix = "unbrt_"
	apiKeySecretBytes       = 32
	apiKeyDisplayPrefixLen  = 4
)

// GeneratedAPIKey is the only place the plaintext token ever exists. Callers
// persist Prefix and Hash and hand Token to the user exactly once.
type GeneratedAPIKey struct {
	Token  string
	Prefix string
	Hash   string
}

func NewAPIKey() (*GeneratedAPIKey, error) {
	return NewOpaqueToken(APIKeyPrefix)
}

// NewOpaqueToken mints a 256-bit random token behind the given prefix. API
// keys, OAuth tokens and authorization codes all share this shape.
func NewOpaqueToken(prefix string) (*GeneratedAPIKey, error) {
	secret := make([]byte, apiKeySecretBytes)
	if _, err := rand.Read(secret); err != nil {
		return nil, err
	}
	token := prefix + base64.RawURLEncoding.EncodeToString(secret)
	return &GeneratedAPIKey{
		Token:  token,
		Prefix: token[:len(prefix)+apiKeyDisplayPrefixLen],
		Hash:   HashAPIKey(token),
	}, nil
}

// HashAPIKey is the storage and lookup form of a token. The token carries 256
// bits of entropy, so a fast hash is enough and a slow one would only add cost.
func HashAPIKey(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func IsAPIKey(token string) bool {
	return strings.HasPrefix(token, APIKeyPrefix)
}

func IsOAuthToken(token string) bool {
	return strings.HasPrefix(token, OAuthAccessTokenPrefix) || strings.HasPrefix(token, OAuthRefreshTokenPrefix)
}

func APIKeyExpired(expiresAt *time.Time, now time.Time) bool {
	return expiresAt != nil && !expiresAt.After(now)
}

type APIKeyLookup interface {
	GetByTokenHash(ctx context.Context, tokenHash string) (*ent.APIKey, error)
}

// VerifyAPIKey resolves a presented key to its stored row with the owner
// loaded. Unknown, ownerless and expired keys all fail the same way.
func VerifyAPIKey(ctx context.Context, keys APIKeyLookup, token string, now time.Time) (*ent.APIKey, bool) {
	hash := HashAPIKey(token)
	key, err := keys.GetByTokenHash(ctx, hash)
	if err != nil || key.Edges.User == nil {
		return nil, false
	}
	if subtle.ConstantTimeCompare([]byte(key.TokenHash), []byte(hash)) != 1 || APIKeyExpired(key.ExpiresAt, now) {
		return nil, false
	}
	return key, true
}
