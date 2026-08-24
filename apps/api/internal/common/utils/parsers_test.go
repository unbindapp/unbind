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

func TestFormatStorageGB(t *testing.T) {
	tests := []struct {
		gb       float64
		expected string
	}{
		{gb: 1, expected: "1Gi"},
		{gb: 10, expected: "10Gi"},
		{gb: 2.5, expected: "2560Mi"},
		{gb: 4.85, expected: "4966Mi"},
		{gb: 0.1, expected: "102Mi"},
		{gb: 0.35, expected: "358Mi"},
		{gb: 0, expected: "0"},
	}

	for _, tt := range tests {
		t.Run(tt.expected, func(t *testing.T) {
			assert.Equal(t, tt.expected, FormatStorageGB(tt.gb))
		})
	}
}

func TestValidateStorageQuantity(t *testing.T) {
	tests := []struct {
		input       string
		expectError bool
	}{
		{input: "10Gi", expectError: false},
		{input: "4966Mi", expectError: false},
		{input: "10G", expectError: false},
		{input: "1024", expectError: false},
		{input: "4.85Gi", expectError: true},
		{input: "0.1Gi", expectError: true},
		{input: "500m", expectError: true},
		{input: "1e3", expectError: true},
		{input: "abc", expectError: true},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			_, err := ValidateStorageQuantity(tt.input)
			if tt.expectError {
				assert.Error(t, err)
				return
			}
			assert.NoError(t, err)
		})
	}
}

func TestValidateStorageQuantityGB(t *testing.T) {
	qty, err := ValidateStorageQuantityGB(4.85)
	assert.NoError(t, err)
	bytes, ok := qty.AsInt64()
	assert.True(t, ok)
	assert.Equal(t, int64(4966*1024*1024), bytes)
}

func TestNormalizeStorageQuantity(t *testing.T) {
	tests := []struct {
		input       string
		expected    string
		expectError bool
	}{
		// Bare numbers are GiB and get rounded to whole mebibytes, which is what the
		// storage sliders send (min 0.1 GiB, 0.25 GiB steps).
		{input: "10.1", expected: "10342Mi"},
		{input: "0.1", expected: "102Mi"},
		{input: "0.25", expected: "256Mi"},
		{input: "2", expected: "2Gi"},
		// Whole-byte quantities pass through untouched.
		{input: "10Gi", expected: "10Gi"},
		{input: "10342Mi", expected: "10342Mi"},
		{input: " 1Gi ", expected: "1Gi"},
		// Fractional units are rounded to whole mebibytes rather than rejected: "0.25Gi" is what
		// earlier template deploys persisted, so it still has to read back.
		{input: "0.25Gi", expected: "256Mi"},
		{input: "0.1Gi", expected: "102Mi"},
		{input: "10.1Gi", expected: "10342Mi"},
		{input: "1.5Gi", expected: "1536Mi"},
		{input: "0", expectError: true},
		{input: "500m", expectError: true},
		{input: "-5", expectError: true},
		{input: "", expectError: true},
		{input: "abc", expectError: true},
		{input: "NaN", expectError: true},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			got, err := NormalizeStorageQuantity(tt.input)
			if tt.expectError {
				assert.Error(t, err)
				return
			}
			assert.NoError(t, err)
			assert.Equal(t, tt.expected, got)
		})
	}
}
