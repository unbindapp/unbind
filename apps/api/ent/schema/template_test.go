package schema

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	"golang.org/x/crypto/bcrypt"
)

func TestGenerateEmail(t *testing.T) {
	cases := map[string]string{
		"http://localhost:3000":     "admin@localhost.com",
		"https://localhost":         "admin@localhost.com",
		"http://unbind.example.com": "admin@unbind.example.com",
		"pb.example.com:8443/":      "admin@pb.example.com",
	}

	for baseDomain, want := range cases {
		gen := &ValueGenerator{Type: GeneratorTypeEmail, BaseDomain: baseDomain}
		resp, err := gen.Generate(nil)
		assert.NoError(t, err)
		assert.Equal(t, want, resp.GeneratedValue, "base domain %q", baseDomain)
	}
}

func TestGeneratePassword(t *testing.T) {
	cases := map[string]struct {
		hashType *ValueHashType
		want     string
	}{
		"plain":  {nil, `^[a-zA-Z][a-zA-Z0-9]{31}$`},
		"sha256": {utils.ToPtr(ValueHashTypeSHA256), `^[0-9a-f]{64}$`},
		"sha512": {utils.ToPtr(ValueHashTypeSHA512), `^[0-9a-f]{128}$`},
	}

	for name, tc := range cases {
		gen := &ValueGenerator{Type: GeneratorTypePassword, HashType: tc.hashType, AddPrefix: "pre-"}
		resp, err := gen.Generate(nil)
		require.NoError(t, err, name)
		assert.Regexp(t, tc.want, strings.TrimPrefix(resp.GeneratedValue, "pre-"), name)
	}
}

func TestGeneratePasswordBcrypt(t *testing.T) {
	gen := &ValueGenerator{Type: GeneratorTypePasswordBcrypt}
	resp, err := gen.Generate(nil)
	require.NoError(t, err)
	assert.Regexp(t, `^[a-zA-Z][a-zA-Z0-9]{31}$`, resp.PlainValue)
	assert.NoError(t, bcrypt.CompareHashAndPassword([]byte(resp.GeneratedValue), []byte(resp.PlainValue)))
}
