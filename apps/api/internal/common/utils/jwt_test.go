package utils

import (
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"fmt"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGenerateGithubJWT(t *testing.T) {
	// Generate a test private key
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err, "Failed to generate private key for testing")

	appID := int64(12345)

	// Call the function under test
	token, err := GenerateGithubJWT(appID, privateKey)
	assert.NoError(t, err, "GenerateGithubJWT should not return an error")
	assert.NotEmpty(t, token, "Generated token should not be empty")

	// Verify the token
	parsedToken, err := jwt.Parse(token, func(token *jwt.Token) (any, error) {
		// Validate the algorithm
		if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return &privateKey.PublicKey, nil
	})

	assert.NoError(t, err, "Token should be parsable")
	assert.True(t, parsedToken.Valid, "Token should be valid")

	// Extract claims
	_, ok := parsedToken.Claims.(jwt.Claims)
	assert.True(t, ok, "Should be able to extract claims")

	// Extract the claims properly
	_, err = parsedToken.Claims.GetIssuedAt()
	assert.NoError(t, err, "Should be able to extract issued at time")

	// Parse as a map to check the claims directly
	_, ok = parsedToken.Claims.(jwt.MapClaims)
	assert.True(t, ok, "Claims should be convertible to jwt.MapClaims")

	// Verify issuer
	issuer, err := parsedToken.Claims.GetIssuer()
	assert.NoError(t, err, "Should be able to extract issuer")
	assert.Equal(t, strconv.FormatInt(appID, 10), issuer, "Issuer claim should match app ID")

	// Verify expiration (10 minutes from issuance)
	issuedAtTime, err := parsedToken.Claims.GetIssuedAt()
	assert.NoError(t, err, "Should be able to extract issued at time")

	expiresAtTime, err := parsedToken.Claims.GetExpirationTime()
	assert.NoError(t, err, "Should be able to extract expiration time")

	// Verify expiration is 10 minutes (600 seconds) after issuance
	expectedExpiration := issuedAtTime.Add(10 * time.Minute)
	assert.Equal(t, expectedExpiration.Unix(), expiresAtTime.Unix(), "Token should expire 10 minutes after issuance")
}

func TestGenerateGithubJWT_VerifyAlgorithm(t *testing.T) {
	// Generate a test private key
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err, "Failed to generate private key for testing")

	appID := int64(12345)

	// Call the function under test
	token, err := GenerateGithubJWT(appID, privateKey)
	assert.NoError(t, err, "GenerateGithubJWT should not return an error")

	// Verify the token uses RS256 algorithm
	parts := strings.Split(token, ".")
	assert.Equal(t, 3, len(parts), "JWT should have three parts")

	// Decode header manually using base64
	headerB64 := parts[0]
	// JWT uses base64url encoding without padding
	// Convert base64url to standard base64 by replacing characters and adding padding if needed
	headerB64 = strings.ReplaceAll(headerB64, "-", "+")
	headerB64 = strings.ReplaceAll(headerB64, "_", "/")
	// Add padding if needed
	switch len(headerB64) % 4 {
	case 2:
		headerB64 += "=="
	case 3:
		headerB64 += "="
	}

	headerBytes, err := base64.StdEncoding.DecodeString(headerB64)
	assert.NoError(t, err, "Should be able to decode header")
	assert.Contains(t, string(headerBytes), "RS256", "Header should specify RS256 algorithm")
}

func TestGenerateGithubJWT_ErrorOnNilKey(t *testing.T) {
	appID := int64(12345)

	// Call with nil key
	token, err := GenerateGithubJWT(appID, nil)
	assert.Error(t, err, "GenerateGithubJWT should return an error with nil private key")
	assert.Empty(t, token, "Token should be empty when error occurs")
}

func TestGenerateGithubJWT_TimeConsistency(t *testing.T) {
	// Generate a test private key
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err, "Failed to generate private key for testing")

	appID := int64(12345)

	// Get current time for reference
	beforeTokenTime := time.Now()

	// Call the function under test
	token, err := GenerateGithubJWT(appID, privateKey)
	assert.NoError(t, err, "GenerateGithubJWT should not return an error")

	// Get time after token generation
	afterTokenTime := time.Now()

	// Parse token to extract issuedAt claim
	parsedToken, err := jwt.Parse(token, func(token *jwt.Token) (any, error) {
		return &privateKey.PublicKey, nil
	})
	assert.NoError(t, err, "Token should be parsable")

	issuedAt, err := parsedToken.Claims.GetIssuedAt()
	assert.NoError(t, err, "Should be able to extract issued at time")

	// Verify that issuedAt is within the time window when the function was called
	assert.GreaterOrEqual(t, issuedAt.Unix(), beforeTokenTime.Unix(), "IssuedAt should not be before test started")
	assert.LessOrEqual(t, issuedAt.Unix(), afterTokenTime.Unix(), "IssuedAt should not be after test ended")
}
