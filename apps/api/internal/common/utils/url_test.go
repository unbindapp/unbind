package utils

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTransformDomain(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "Simple domain",
			input:    "example",
			expected: "example",
		},
		{
			name:     "Domain with dots",
			input:    "example.com",
			expected: "example-com",
		},
		{
			name:     "Domain with special characters",
			input:    "hello.world!@#$%^&*",
			expected: "hello-world",
		},
		{
			name:     "Domain with multiple dots",
			input:    "sub.domain.example.com",
			expected: "sub-domain-example-com",
		},
		{
			name:     "Domain with leading and trailing special chars",
			input:    ".example.com.",
			expected: "example-com",
		},
		{
			name:     "Domain with consecutive special chars",
			input:    "example..com",
			expected: "example-com",
		},
		{
			name:     "Domain with hyphen",
			input:    "my-domain.com",
			expected: "my-domain-com",
		},
		{
			name:     "Domain with underscore",
			input:    "my_domain.com",
			expected: "my-domain-com",
		},
		{
			name:     "Empty string",
			input:    "",
			expected: "",
		},
		{
			name:     "Only special characters",
			input:    "....",
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := transformDomain(tt.input)
			assert.Equal(t, tt.expected, result, "They should be equal")
		})
	}
}

func TestValidateAndExtractDomain(t *testing.T) {
	tests := []struct {
		name           string
		input          string
		expectedResult string
		expectError    bool
		errorContains  string
	}{
		{
			name:           "Valid HTTP URL with port",
			input:          "http://localhost:8099",
			expectedResult: "localhost",
			expectError:    false,
		},
		{
			name:           "Valid HTTPS URL",
			input:          "https://unbind.app",
			expectedResult: "unbind-app",
			expectError:    false,
		},
		{
			name:           "Invalid scheme",
			input:          "ht://localhost:8099",
			expectedResult: "",
			expectError:    true,
			errorContains:  "invalid URL scheme",
		},
		{
			name:           "Valid URL with subdomain",
			input:          "https://sub.example.com",
			expectedResult: "sub-example-com",
			expectError:    false,
		},
		{
			name:           "Valid URL with path",
			input:          "https://example.com/path/to/resource",
			expectedResult: "example-com",
			expectError:    false,
		},
		{
			name:           "Valid URL with query params",
			input:          "https://example.com?param=value",
			expectedResult: "example-com",
			expectError:    false,
		},
		{
			name:           "Valid URL with fragment",
			input:          "https://example.com#section",
			expectedResult: "example-com",
			expectError:    false,
		},
		{
			name:           "Valid URL with username and password",
			input:          "https://user:pass@example.com",
			expectedResult: "example-com",
			expectError:    false,
		},
		{
			name:           "Empty string",
			input:          "",
			expectedResult: "",
			expectError:    true,
		},
		{
			name:           "Invalid URL format",
			input:          "not a url",
			expectedResult: "",
			expectError:    true,
		},
		{
			name:           "Missing scheme",
			input:          "example.com",
			expectedResult: "",
			expectError:    true,
			errorContains:  "invalid URL scheme",
		},
		{
			name:           "FTP URL (invalid scheme)",
			input:          "ftp://example.com",
			expectedResult: "",
			expectError:    true,
			errorContains:  "invalid URL scheme",
		},
		{
			name:           "URL with IP address",
			input:          "http://192.168.1.1",
			expectedResult: "192-168-1-1",
			expectError:    false,
		},
		{
			name:           "URL with IPv6 address",
			input:          "http://[2001:db8::1]",
			expectedResult: "2001-db8-1",
			expectError:    false,
		},
		{
			name:           "URL with unusual characters in domain",
			input:          "https://example-site!.com",
			expectedResult: "example-site-com",
			expectError:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := ValidateAndExtractDomain(tt.input)

			// Check error expectation
			if tt.expectError {
				assert.Error(t, err, "Expected an error but got none")
				if tt.errorContains != "" {
					assert.Contains(t, err.Error(), tt.errorContains, "Error message should contain expected text")
				}
			} else {
				assert.NoError(t, err, "Did not expect an error")
				assert.Equal(t, tt.expectedResult, result, "Results should match")
			}
		})
	}
}

func TestJoinURLPaths(t *testing.T) {
	tests := []struct {
		name     string
		baseURL  string
		paths    []string
		expected string
		wantErr  bool
	}{
		{
			name:     "simple join",
			baseURL:  "https://google.com",
			paths:    []string{"search", "fiveguys"},
			expected: "https://google.com/search/fiveguys",
			wantErr:  false,
		},
		{
			name:     "base URL with trailing slash",
			baseURL:  "https://google.com/",
			paths:    []string{"search", "fiveguys"},
			expected: "https://google.com/search/fiveguys",
			wantErr:  false,
		},
		{
			name:     "paths with leading slashes",
			baseURL:  "https://google.com",
			paths:    []string{"/search", "/fiveguys"},
			expected: "https://google.com/search/fiveguys",
			wantErr:  false,
		},
		{
			name:     "paths with trailing slashes",
			baseURL:  "https://google.com",
			paths:    []string{"search/", "fiveguys/"},
			expected: "https://google.com/search/fiveguys",
			wantErr:  false,
		},
		{
			name:     "empty paths",
			baseURL:  "https://google.com",
			paths:    []string{},
			expected: "https://google.com",
			wantErr:  false,
		},
		{
			name:     "with query parameters",
			baseURL:  "https://google.com?param=value",
			paths:    []string{"search", "fiveguys"},
			expected: "https://google.com/search/fiveguys?param=value",
			wantErr:  false,
		},
		{
			name:     "with fragment",
			baseURL:  "https://google.com#fragment",
			paths:    []string{"search", "fiveguys"},
			expected: "https://google.com/search/fiveguys#fragment",
			wantErr:  false,
		},
		{
			name:     "with existing path",
			baseURL:  "https://google.com/api",
			paths:    []string{"search", "fiveguys"},
			expected: "https://google.com/api/search/fiveguys",
			wantErr:  false,
		},
		{
			name:     "with double slashes",
			baseURL:  "https://google.com",
			paths:    []string{"search//", "//fiveguys"},
			expected: "https://google.com/search/fiveguys",
			wantErr:  false,
		},
		{
			name:     "invalid URL",
			baseURL:  ":invalid-url",
			paths:    []string{"search", "fiveguys"},
			expected: "",
			wantErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := JoinURLPaths(tt.baseURL, tt.paths...)

			if tt.wantErr {
				assert.Error(t, err)
				return
			}

			require.NoError(t, err)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestGenerateSubdomain(t *testing.T) {
	tests := []struct {
		name        string
		displayName string
		externalURL string
		expected    string
		expectError bool
	}{
		{
			name:        "Basic case",
			displayName: "React App",
			externalURL: "https://unbind.app",
			expected:    "react-app.unbind.app",
			expectError: false,
		},
		{
			name:        "With special characters",
			displayName: "React_App!@#",
			externalURL: "https://unbind.app",
			expected:    "react-app.unbind.app",
			expectError: false,
		},
		{
			name:        "Lowercase conversion",
			displayName: "UPPERCASE APP",
			externalURL: "https://unbind.app",
			expected:    "uppercase-app.unbind.app",
			expectError: false,
		},
		{
			name:        "Multiple spaces and hyphens",
			displayName: "My  Cool   App",
			externalURL: "https://unbind.app",
			expected:    "my-cool-app.unbind.app",
			expectError: false,
		},
		{
			name:        "With subdomain in external URL",
			displayName: "Auth Service",
			externalURL: "https://api.unbind.app",
			expected:    "auth-service.api.unbind.app",
			expectError: false,
		},
		{
			name:        "With port in external URL",
			displayName: "API",
			externalURL: "http://localhost:8089",
			expected:    "api.localhost",
			expectError: false,
		},
		{
			name:        "Invalid external URL",
			displayName: "App",
			externalURL: "://invalid",
			expected:    "",
			expectError: true,
		},
		{
			name:        "Leading and trailing hyphens",
			displayName: "-Frontend-",
			externalURL: "https://unbind.app",
			expected:    "frontend.unbind.app",
			expectError: false,
		},
		{
			name:        "Non-alphanumeric characters only",
			displayName: "!@#$%^",
			externalURL: "https://unbind.app",
			expected:    "",
			expectError: true, // Now returns an error
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := GenerateSubdomain(tt.displayName, tt.externalURL)

			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expected, result)
			}
		})
	}
}

func TestSanitizeForSubdomain(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"Simple Test", "simple-test"},
		{"UPPERCASE", "uppercase"},
		{"with_underscore", "with-underscore"},
		{"   spaces   ", "spaces"},
		{"special!@#$chars", "specialchars"},
		{"multiple--hyphens", "multiple-hyphens"},
		{"-leading-trailing-", "leading-trailing"},
		{"a", "a"},
		{"", ""},
		{"123", "123"},
		{"a-1-b-2", "a-1-b-2"},
		{"a---b", "a-b"},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := sanitizeForSubdomain(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}
