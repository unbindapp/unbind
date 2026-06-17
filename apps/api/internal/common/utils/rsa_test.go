package utils

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDecodePrivateKey(t *testing.T) {
	// Generate a private key for testing
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err, "Failed to generate private key for testing")

	// Encode the private key in PEM format
	privateKeyBytes := x509.MarshalPKCS1PrivateKey(privateKey)
	pemBlock := &pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: privateKeyBytes,
	}
	pemData := string(pem.EncodeToMemory(pemBlock))

	t.Run("Valid PEM encoded RSA private key", func(t *testing.T) {
		// Decode the private key
		decodedKey, err := DecodePrivateKey(pemData)

		// Assert no error occurred
		assert.NoError(t, err, "DecodePrivateKey should not return an error for valid key")

		// Assert the decoded key is not nil
		assert.NotNil(t, decodedKey, "Decoded key should not be nil")

		// Verify the key is the same as the original
		assert.Equal(t, privateKey.N, decodedKey.N, "Decoded key modulus should match original")
		assert.Equal(t, privateKey.E, decodedKey.E, "Decoded key exponent should match original")
		assert.Equal(t, privateKey.D, decodedKey.D, "Decoded key D value should match original")
		assert.Equal(t, privateKey.Primes[0], decodedKey.Primes[0], "Decoded key prime 1 should match original")
		assert.Equal(t, privateKey.Primes[1], decodedKey.Primes[1], "Decoded key prime 2 should match original")
	})

	t.Run("Invalid PEM format", func(t *testing.T) {
		// Test with invalid PEM data
		invalidPEM := "This is not a valid PEM format"

		// Attempt to decode the invalid key
		decodedKey, err := DecodePrivateKey(invalidPEM)

		// Assert that an error occurred
		assert.Error(t, err, "DecodePrivateKey should return an error for invalid PEM format")
		assert.Nil(t, decodedKey, "Decoded key should be nil when an error occurs")
		assert.Contains(t, err.Error(), "failed to decode private key", "Error message should indicate failure to decode")
	})

	t.Run("Empty key data", func(t *testing.T) {
		// Test with empty string
		emptyKey := ""

		// Attempt to decode the empty key
		decodedKey, err := DecodePrivateKey(emptyKey)

		// Assert that an error occurred
		assert.Error(t, err, "DecodePrivateKey should return an error for empty key data")
		assert.Nil(t, decodedKey, "Decoded key should be nil when an error occurs")
		assert.Contains(t, err.Error(), "failed to decode private key", "Error message should indicate failure to decode")
	})

	t.Run("Non-RSA private key format", func(t *testing.T) {
		// Create a PEM block with wrong type
		nonRSABlock := &pem.Block{
			Type:  "EC PRIVATE KEY", // Not RSA
			Bytes: []byte("not an RSA key"),
		}
		nonRSAPEM := string(pem.EncodeToMemory(nonRSABlock))

		// Attempt to decode the non-RSA key
		decodedKey, err := DecodePrivateKey(nonRSAPEM)

		// Assert that an error occurred, but it will be at the parsing stage, not the decoding stage
		assert.Error(t, err, "DecodePrivateKey should return an error for non-RSA key")
		assert.Nil(t, decodedKey, "Decoded key should be nil when an error occurs")
		// The error will be from x509.ParsePKCS1PrivateKey, not our "failed to decode" message
	})

	t.Run("Malformed key bytes", func(t *testing.T) {
		// Create a PEM block with correct format but invalid bytes
		malformedBlock := &pem.Block{
			Type:  "RSA PRIVATE KEY",
			Bytes: []byte("malformed key data"),
		}
		malformedPEM := string(pem.EncodeToMemory(malformedBlock))

		// Attempt to decode the malformed key
		decodedKey, err := DecodePrivateKey(malformedPEM)

		// Assert that an error occurred at the parsing stage
		assert.Error(t, err, "DecodePrivateKey should return an error for malformed key bytes")
		assert.Nil(t, decodedKey, "Decoded key should be nil when an error occurs")
		// The error will be from x509.ParsePKCS1PrivateKey
	})
}
