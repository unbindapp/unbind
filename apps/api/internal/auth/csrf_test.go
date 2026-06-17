package auth

import (
	"crypto/rand"
	"crypto/rsa"
	"testing"
)

func TestCSRFToken(t *testing.T) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	secret := CSRFSecret(key)

	const session = "11111111-2222-3333-4444-555555555555"
	token := MintCSRFToken(secret, session)

	if token == "" {
		t.Fatal("expected non-empty token")
	}
	if got := MintCSRFToken(secret, session); got != token {
		t.Fatalf("token not deterministic: %q != %q", got, token)
	}
	if !VerifyCSRFToken(secret, session, token) {
		t.Fatal("expected valid token to verify")
	}
	if VerifyCSRFToken(secret, "other-session", token) {
		t.Fatal("token must not verify against a different session")
	}
	if VerifyCSRFToken(secret, session, token+"x") {
		t.Fatal("tampered token must not verify")
	}

	otherKey, _ := rsa.GenerateKey(rand.Reader, 2048)
	if VerifyCSRFToken(CSRFSecret(otherKey), session, token) {
		t.Fatal("token must not verify under a different secret")
	}
}
