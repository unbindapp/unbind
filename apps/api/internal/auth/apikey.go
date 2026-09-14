package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"strings"
	"time"
)

const (
	APIKeyPrefix           = "unb_"
	apiKeySecretBytes      = 32
	apiKeyDisplayPrefixLen = 8
)

// GeneratedAPIKey is the only place the plaintext token ever exists. Callers
// persist Prefix and Hash and hand Token to the user exactly once.
type GeneratedAPIKey struct {
	Token  string
	Prefix string
	Hash   string
}

func NewAPIKey() (*GeneratedAPIKey, error) {
	secret := make([]byte, apiKeySecretBytes)
	if _, err := rand.Read(secret); err != nil {
		return nil, err
	}
	token := APIKeyPrefix + base64.RawURLEncoding.EncodeToString(secret)
	return &GeneratedAPIKey{
		Token:  token,
		Prefix: token[:len(APIKeyPrefix)+apiKeyDisplayPrefixLen],
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

func APIKeyExpired(expiresAt *time.Time, now time.Time) bool {
	return expiresAt != nil && !expiresAt.After(now)
}
