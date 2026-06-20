package schema

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"time"

	siv "github.com/secure-io/siv-go"
)

// Convex self-hosted admin keys are produced by the backend's KeyBroker
// (crates/keybroker in get-convex/convex-backend). The format is:
//
//	<instance_name>|<hex( version(1) || nonce(12) || ciphertext || tag(16) )>
//
// where the ciphertext is the AES-128-GCM-SIV encryption (RFC 8452) of a
// protobuf-encoded AdminKey message, the key is derived from the 32-byte
// instance secret via KBKDF-CTR-HMAC-SHA256 with the label "admin key", and the
// AAD is the single version byte.
//
// Because we generate the instance secret ourselves at deploy time, we can mint
// a valid admin key here instead of making the user shell into the backend pod
// to run ./generate_admin_key.sh. This implementation is verified byte-for-byte
// against the real generate_key binary (see convex_admin_key_test.go).
const (
	convexAdminKeyVersion byte = 1
	convexAdminKeyLabel        = "admin key"
)

// deriveConvexAdminKeyKey derives the 16-byte AES-128 key from the instance
// secret. This is the single-iteration KBKDF counter-mode HMAC-SHA256 that
// aws-lc-rs's kbkdf_ctr_hmac performs for a 16-byte output:
// HMAC-SHA256(secret, BE32(1) || label)[:16].
func deriveConvexAdminKeyKey(secret []byte) []byte {
	mac := hmac.New(sha256.New, secret)
	var counter [4]byte
	binary.BigEndian.PutUint32(counter[:], 1)
	mac.Write(counter[:])
	mac.Write([]byte(convexAdminKeyLabel))
	return mac.Sum(nil)[:16]
}

// encodeConvexAdminKeyProto encodes the AdminKey protobuf message for a generic
// admin key (instance_name unset, member_id 0, is_read_only false). Only the
// issued_s (field 2) and member_id (field 3, oneof) fields are emitted.
func encodeConvexAdminKeyProto(issuedS uint64) []byte {
	out := make([]byte, 0, 8)
	out = append(out, 0x10) // field 2 (issued_s), wire type 0 (varint)
	out = binary.AppendUvarint(out, issuedS)
	out = append(out, 0x18, 0x00) // field 3 (member_id) = 0
	return out
}

// generateConvexAdminKey mints a valid Convex admin key for the given instance
// name and 32-byte instance secret.
func generateConvexAdminKey(instanceName string, secret []byte, issuedS uint64) (string, error) {
	if len(secret) != 32 {
		return "", fmt.Errorf("convex instance secret must be 32 bytes, got %d", len(secret))
	}

	aead, err := siv.NewGCM(deriveConvexAdminKeyKey(secret))
	if err != nil {
		return "", fmt.Errorf("failed to build AES-GCM-SIV cipher: %w", err)
	}

	nonce := make([]byte, aead.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}

	sealed := aead.Seal(nil, nonce, encodeConvexAdminKeyProto(issuedS), []byte{convexAdminKeyVersion})

	encrypted := make([]byte, 0, 1+len(nonce)+len(sealed))
	encrypted = append(encrypted, convexAdminKeyVersion)
	encrypted = append(encrypted, nonce...)
	encrypted = append(encrypted, sealed...)

	return fmt.Sprintf("%s|%s", instanceName, hex.EncodeToString(encrypted)), nil
}

// GenerateConvexInstanceSecretAndAdminKey generates a fresh 32-byte instance
// secret (returned hex-encoded for INSTANCE_SECRET) along with a matching admin
// key for the given instance name.
func GenerateConvexInstanceSecretAndAdminKey(instanceName string) (instanceSecretHex string, adminKey string, err error) {
	secret := make([]byte, 32)
	if _, err := rand.Read(secret); err != nil {
		return "", "", err
	}

	adminKey, err = generateConvexAdminKey(instanceName, secret, uint64(time.Now().Unix()))
	if err != nil {
		return "", "", err
	}

	return hex.EncodeToString(secret), adminKey, nil
}
