package auth

import (
	"strings"
	"testing"
	"time"
)

func TestNewAPIKey(t *testing.T) {
	first, err := NewAPIKey()
	if err != nil {
		t.Fatal(err)
	}
	second, err := NewAPIKey()
	if err != nil {
		t.Fatal(err)
	}

	if !strings.HasPrefix(first.Token, APIKeyPrefix) {
		t.Fatalf("token %q lacks prefix", first.Token)
	}
	if len(first.Token) != len(APIKeyPrefix)+43 {
		t.Fatalf("token length = %d, want 32 random bytes as base64url", len(first.Token))
	}
	if !strings.HasPrefix(first.Token, first.Prefix) || len(first.Prefix) != len(APIKeyPrefix)+apiKeyDisplayPrefixLen {
		t.Fatalf("display prefix %q does not lead the token", first.Prefix)
	}
	if first.Hash != HashAPIKey(first.Token) {
		t.Fatal("hash does not match the token")
	}
	if first.Token == second.Token || first.Hash == second.Hash {
		t.Fatal("two keys collided")
	}
	if strings.Contains(first.Hash, first.Token[len(APIKeyPrefix):]) {
		t.Fatal("hash leaks the token")
	}
}

func TestIsAPIKey(t *testing.T) {
	tests := map[string]bool{
		"unb_abc":               true,
		"unb_":                  true,
		"eyJhbGciOiJSUzI1NiJ9.": false,
		"":                      false,
		"UNB_abc":               false,
	}
	for token, want := range tests {
		if got := IsAPIKey(token); got != want {
			t.Fatalf("IsAPIKey(%q) = %v, want %v", token, got, want)
		}
	}
}

func TestAPIKeyExpired(t *testing.T) {
	now := time.Now()
	past := now.Add(-time.Second)
	future := now.Add(time.Second)

	if APIKeyExpired(nil, now) {
		t.Fatal("a key without expiry never expires")
	}
	if !APIKeyExpired(&past, now) {
		t.Fatal("past expiry should be expired")
	}
	if !APIKeyExpired(&now, now) {
		t.Fatal("expiry equal to now should be expired")
	}
	if APIKeyExpired(&future, now) {
		t.Fatal("future expiry should be valid")
	}
}

func TestOpaqueTokenPrefixes(t *testing.T) {
	access, err := NewOpaqueToken(OAuthAccessTokenPrefix)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(access.Token, "unbat_") || !IsOAuthToken(access.Token) || IsAPIKey(access.Token) {
		t.Fatalf("access token %q must be an oauth token and not an api key", access.Token)
	}
	if access.Hash != HashAPIKey(access.Token) {
		t.Fatal("hash must be the storage form of the token")
	}

	refresh, err := NewOpaqueToken(OAuthRefreshTokenPrefix)
	if err != nil {
		t.Fatal(err)
	}
	if !IsOAuthToken(refresh.Token) || IsAPIKey(refresh.Token) {
		t.Fatalf("refresh token %q must be an oauth token and not an api key", refresh.Token)
	}

	code, err := NewOpaqueToken("")
	if err != nil {
		t.Fatal(err)
	}
	if IsOAuthToken(code.Token) || IsAPIKey(code.Token) || len(code.Token) != 43 {
		t.Fatalf("bare code %q must carry no prefix", code.Token)
	}

	key, err := NewAPIKey()
	if err != nil {
		t.Fatal(err)
	}
	if !IsAPIKey(key.Token) || IsOAuthToken(key.Token) {
		t.Fatalf("api key %q must not be an oauth token", key.Token)
	}
}
