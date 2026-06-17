package auth

import (
	"crypto/hmac"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
)

// CSRFSecret derives a stable HMAC key from the RSA signing key. The key is
// persisted and restart-stable, so the derived secret is too — no separate
// config value is needed.
func CSRFSecret(privateKey *rsa.PrivateKey) []byte {
	der := x509.MarshalPKCS1PrivateKey(privateKey)
	sum := sha256.Sum256(der)
	return sum[:]
}

// MintCSRFToken binds a CSRF token to a session by HMAC'ing the refresh token.
// The token is deterministic per (secret, session), so the cookie and the
// echoed header match across requests without server-side storage.
func MintCSRFToken(secret []byte, sessionID string) string {
	mac := hmac.New(sha256.New, secret)
	mac.Write([]byte(sessionID))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func VerifyCSRFToken(secret []byte, sessionID, presented string) bool {
	expected := MintCSRFToken(secret, sessionID)
	return hmac.Equal([]byte(expected), []byte(presented))
}
