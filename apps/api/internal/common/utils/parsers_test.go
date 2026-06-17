package utils

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestExtractRepoName(t *testing.T) {
	tests := []struct {
		name        string
		input       string
		expected    string
		expectError bool
		errorMsg    string
	}{
		{
			name:        "Valid GitHub URL with .git suffix",
			input:       "https://github.com/unbindapp/unbind-operator.git",
			expected:    "unbind-operator",
			expectError: false,
		},
		{
			name:        "Valid GitHub URL without .git suffix",
			input:       "https://github.com/kubernetes/kubernetes",
			expected:    "kubernetes",
			expectError: false,
		},
		{
			name:        "Valid GitLab URL with .git suffix",
			input:       "https://gitlab.com/gitlab-org/gitlab.git",
			expected:    "gitlab",
			expectError: false,
		},
		{
			name:        "URL with subdirectories",
			input:       "https://github.com/org/repo/subdirectory/project.git",
			expected:    "project",
			expectError: false,
		},
		{
			name:        "Invalid URL format",
			input:       "u:::::/a| not-a-url",
			expected:    "",
			expectError: true,
			errorMsg:    "invalid URL format",
		},
		{
			name:        "Missing repository path",
			input:       "https://github.com",
			expected:    "",
			expectError: true,
			errorMsg:    "no repository path found in URL",
		},
		{
			name:        "Missing repository name",
			input:       "https://github.com/org/",
			expected:    "",
			expectError: true,
			errorMsg:    "empty repository name",
		},
		{
			name:        "Only organization name",
			input:       "https://github.com/org",
			expected:    "",
			expectError: true,
			errorMsg:    "invalid repository path format",
		},
		{
			name:        "Empty URL",
			input:       "",
			expected:    "",
			expectError: true,
			errorMsg:    "invalid URL format",
		},
		{
			name:        "URL with special characters",
			input:       "https://github.com/org/repo-with-dashes.git",
			expected:    "repo-with-dashes",
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := ExtractRepoName(tt.input)

			if tt.expectError {
				assert.Error(t, err)
				assert.Equal(t, tt.errorMsg, err.Error())
				assert.Empty(t, result)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expected, result)
			}
		})
	}
}
