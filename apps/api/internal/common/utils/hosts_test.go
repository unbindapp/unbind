package utils

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestValidateServiceHost(t *testing.T) {
	valid := []string{
		"example.com",
		"app.example.com",
		"APP.Example.com",
		"xn--mnchen-3ya.de",
		"my-app.localhost",
		"*.example.com",
		"*.apps.example.com",
	}
	for _, host := range valid {
		assert.NoError(t, ValidateServiceHost(host), host)
	}

	invalid := []string{
		"",
		"localhost",
		"*.com",
		"*",
		"*.",
		"*.*.example.com",
		"app.*.example.com",
		"*app.example.com",
		"example.com.",
		"https://example.com",
		"example.com/path",
		"exa mple.com",
		"-app.example.com",
		"app_name.example.com",
		strings.Repeat("a", 64) + ".example.com",
		strings.Repeat("a.", 126) + "com",
	}
	for _, host := range invalid {
		assert.Error(t, ValidateServiceHost(host), host)
	}
}

func TestWildcardCovers(t *testing.T) {
	tests := []struct {
		pattern string
		host    string
		want    bool
	}{
		{"*.example.com", "app.example.com", true},
		{"*.example.com", "a.b.example.com", true},
		{"*.Example.com", "APP.example.COM", true},
		{"*.example.com", "*.apps.example.com", true},
		{"*.example.com", "example.com", false},
		{"*.example.com", "*.example.com", false},
		{"*.example.com", "badexample.com", false},
		{"*.example.com", "app.example.org", false},
		{"*.apps.example.com", "*.example.com", false},
		{"example.com", "app.example.com", false},
	}
	for _, tt := range tests {
		assert.Equal(t, tt.want, WildcardCovers(tt.pattern, tt.host), "%s covers %s", tt.pattern, tt.host)
	}
}

func TestHostsOverlap(t *testing.T) {
	tests := []struct {
		a    string
		b    string
		want bool
	}{
		{"example.com", "EXAMPLE.com", true},
		{"*.example.com", "*.example.com", true},
		{"*.example.com", "app.example.com", true},
		{"app.example.com", "*.example.com", true},
		{"*.apps.example.com", "*.example.com", true},
		{"*.example.com", "example.com", false},
		{"app.example.com", "api.example.com", false},
		{"*.a.example.com", "*.b.example.com", false},
	}
	for _, tt := range tests {
		assert.Equal(t, tt.want, HostsOverlap(tt.a, tt.b), "%s and %s", tt.a, tt.b)
	}
}

func TestProbeHost(t *testing.T) {
	assert.Equal(t, "unbind-dns-check.example.com", ProbeHost("*.example.com"))
	assert.Equal(t, "app.example.com", ProbeHost("app.example.com"))
}
