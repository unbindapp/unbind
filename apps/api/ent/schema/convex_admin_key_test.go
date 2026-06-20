package schema

import (
	"encoding/binary"
	"encoding/hex"
	"strings"
	"testing"

	siv "github.com/secure-io/siv-go"
)

// These vectors were produced by the real Convex generate_key binary
// (ghcr.io/get-convex/convex-backend) with the given instance names and
// secrets. Decrypting them with our implementation proves the key derivation,
// AES-128-GCM-SIV parameters, AAD, and protobuf layout match the backend.
var convexRealKeyVectors = []struct {
	instanceName string
	secretHex    string
	adminKey     string
}{
	{
		"convex-self-hosted",
		"4361726e697461732c206c69746572616c6c79206d65616e696e672022636172",
		"convex-self-hosted|01ef9024270448d86a50e8f5e13e5c0880716265b5b87e85b0cbc72bbe2bec4a017bbac741",
	},
	{
		"my-app-1",
		"1376853b1c73ce288fc77ec591d1b56d670b47fee3433c24272a0a6140d88a4d",
		"my-app-1|01969b0bacba39fa3f89d32e803068f922f39804372ada07b62b2d84533662b572bbd02e58",
	},
	{
		"my-app-2",
		"6d8e60f075a121e43b133078061512fdf5572a7b1c585bd0ba9c2e8956edc766",
		"my-app-2|019f2380f3e79c32fe7754a2f2ff3dc718a678b15f0c12aba00a056b63df30f27926f040d1",
	},
}

// decryptConvexAdminKey reverses generateConvexAdminKey, returning the decoded
// issued_s and member_id. It mirrors the backend's check_admin_key decrypt path.
func decryptConvexAdminKey(t *testing.T, adminKey, secretHex string) (issuedS, memberID uint64) {
	t.Helper()
	secret, err := hex.DecodeString(secretHex)
	if err != nil {
		t.Fatal(err)
	}
	_, encHex, ok := strings.Cut(adminKey, "|")
	if !ok {
		t.Fatalf("admin key missing instance prefix: %s", adminKey)
	}
	enc, err := hex.DecodeString(encHex)
	if err != nil {
		t.Fatal(err)
	}
	version := enc[0]
	nonce := enc[1:13]
	ct := enc[13:]

	aead, err := siv.NewGCM(deriveConvexAdminKeyKey(secret))
	if err != nil {
		t.Fatal(err)
	}
	pt, err := aead.Open(nil, nonce, ct, []byte{version})
	if err != nil {
		t.Fatalf("decrypt failed: %v", err)
	}
	if pt[0] != 0x10 {
		t.Fatalf("unexpected first proto tag %#x", pt[0])
	}
	issuedS, n := binary.Uvarint(pt[1:])
	memberID, _ = binary.Uvarint(pt[1+n+1:])
	return issuedS, memberID
}

// TestConvexAdminKey_DecryptsRealKeys confirms our crypto matches keys minted by
// the real backend binary.
func TestConvexAdminKey_DecryptsRealKeys(t *testing.T) {
	for _, v := range convexRealKeyVectors {
		issued, member := decryptConvexAdminKey(t, v.adminKey, v.secretHex)
		if member != 0 {
			t.Errorf("%s: member_id = %d, want 0", v.instanceName, member)
		}
		if issued < 1_600_000_000 || issued > 2_000_000_000 {
			t.Errorf("%s: issued_s = %d, out of sane range", v.instanceName, issued)
		}
	}
}

// TestConvexAdminKey_RoundTrip confirms a key we mint decrypts back to the same
// fields with the matching secret.
func TestConvexAdminKey_RoundTrip(t *testing.T) {
	secretHex, adminKey, err := GenerateConvexInstanceSecretAndAdminKey("convex-self-hosted")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(adminKey, "convex-self-hosted|") {
		t.Fatalf("admin key missing instance prefix: %s", adminKey)
	}
	if len(secretHex) != 64 {
		t.Fatalf("instance secret hex length = %d, want 64", len(secretHex))
	}
	_, member := decryptConvexAdminKey(t, adminKey, secretHex)
	if member != 0 {
		t.Fatalf("member_id = %d, want 0", member)
	}
}
