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

// Replicates Convex's KeyBroker (crates/keybroker). Admin key format:
//
//	<instance_name>|<hex( version(1) || nonce(12) || ciphertext || tag(16) )>
//
// ciphertext = AES-128-GCM-SIV of a protobuf AdminKey, AAD = version byte, key =
// KBKDF-CTR-HMAC-SHA256(instance_secret, "admin key")[:16]. Verified against the
// real generate_key binary in convex_admin_key_test.go.
const (
	convexAdminKeyVersion byte = 1
	convexAdminKeyLabel        = "admin key"
)

func deriveConvexAdminKeyKey(secret []byte) []byte {
	mac := hmac.New(sha256.New, secret)
	var counter [4]byte
	binary.BigEndian.PutUint32(counter[:], 1)
	mac.Write(counter[:])
	mac.Write([]byte(convexAdminKeyLabel))
	return mac.Sum(nil)[:16]
}

func encodeConvexAdminKeyProto(issuedS uint64) []byte {
	out := make([]byte, 0, 8)
	out = append(out, 0x10) // field 2 (issued_s), wire type 0 (varint)
	out = binary.AppendUvarint(out, issuedS)
	out = append(out, 0x18, 0x00) // field 3 (member_id) = 0
	return out
}

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

// GenerateConvexInstanceSecretAndAdminKey returns a fresh hex INSTANCE_SECRET and
// a matching admin key.
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
