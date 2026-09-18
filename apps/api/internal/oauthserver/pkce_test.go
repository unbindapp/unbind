package oauthserver

import (
	"crypto/sha256"
	"encoding/base64"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestValidPKCEValue(t *testing.T) {
	cases := map[string]bool{
		strings.Repeat("a", 43):          true,
		strings.Repeat("a", 128):         true,
		strings.Repeat("a", 42):          false,
		strings.Repeat("a", 129):         false,
		strings.Repeat("a", 42) + "-._~": true,
		strings.Repeat("a", 42) + "+":    false,
		strings.Repeat("a", 42) + "/":    false,
		strings.Repeat("a", 42) + " ":    false,
	}
	for value, want := range cases {
		assert.Equal(t, want, ValidPKCEValue(value), value)
	}
}

func TestVerifyS256(t *testing.T) {
	verifier := strings.Repeat("v", 50)
	sum := sha256.Sum256([]byte(verifier))
	challenge := base64.RawURLEncoding.EncodeToString(sum[:])

	assert.True(t, VerifyS256(verifier, challenge))
	assert.False(t, VerifyS256(strings.Repeat("w", 50), challenge))
	assert.False(t, VerifyS256("short", challenge))
	assert.False(t, VerifyS256(verifier, base64.StdEncoding.EncodeToString(sum[:])))
}
