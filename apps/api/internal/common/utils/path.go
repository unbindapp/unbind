package utils

import (
	"strings"
)

// IsValidUnixPath checks if the given path is a valid Unix-style path.
// A valid Unix path:
// - Starts with a forward slash (/)
// - Contains only forward slashes as separators
// - Does not contain Windows-style backslashes
// - Does not contain invalid characters
func IsValidUnixPath(path string) bool {
	// Empty path is invalid
	if path == "" {
		return false
	}

	// Must start with forward slash
	if !strings.HasPrefix(path, "/") {
		return false
	}

	// Must not contain Windows-style backslashes
	if strings.Contains(path, "\\") {
		return false
	}

	// Check for invalid characters
	invalidChars := []string{"<", ">", ":", "\"", "|", "?", "*"}
	for _, char := range invalidChars {
		if strings.Contains(path, char) {
			return false
		}
	}

	// Check for consecutive slashes
	if strings.Contains(path, "//") {
		return false
	}

	return true
}
