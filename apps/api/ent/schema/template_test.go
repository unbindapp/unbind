package schema

import (
	"testing"

	"github.com/stretchr/testify/assert"
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
