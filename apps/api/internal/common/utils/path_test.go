package utils

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestIsValidUnixPath(t *testing.T) {
	tests := []struct {
		name     string
		path     string
		expected bool
	}{
		{
			name:     "valid root path",
			path:     "/",
			expected: true,
		},
		{
			name:     "valid nested path",
			path:     "/root/abc/def",
			expected: true,
		},
		{
			name:     "valid path with single character segments",
			path:     "/a/b/c",
			expected: true,
		},
		{
			name:     "invalid empty path",
			path:     "",
			expected: false,
		},
		{
			name:     "invalid Windows path",
			path:     "c:\\asdsa",
			expected: false,
		},
		{
			name:     "invalid path without leading slash",
			path:     "root/abc/def",
			expected: false,
		},
		{
			name:     "invalid path with consecutive slashes",
			path:     "/root//abc/def",
			expected: false,
		},
		{
			name:     "invalid path with Windows backslash",
			path:     "/root\\abc\\def",
			expected: false,
		},
		{
			name:     "invalid path with colon",
			path:     "/root:abc/def",
			expected: false,
		},
		{
			name:     "invalid path with asterisk",
			path:     "/root/*/def",
			expected: false,
		},
		{
			name:     "invalid path with question mark",
			path:     "/root/abc?/def",
			expected: false,
		},
		{
			name:     "invalid path with angle brackets",
			path:     "/root/<abc>/def",
			expected: false,
		},
		{
			name:     "invalid path with pipe",
			path:     "/root/abc|def",
			expected: false,
		},
		{
			name:     "invalid path with double quotes",
			path:     "/root/\"abc\"/def",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := IsValidUnixPath(tt.path)
			assert.Equal(t, tt.expected, result, "path: %s", tt.path)
		})
	}
}
