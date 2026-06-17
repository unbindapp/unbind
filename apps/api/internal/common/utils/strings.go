package utils

import (
	"strings"
)

// Makes sure a string contains one interpolation marker, ${} , allow escaping to ignore
func ContainsExactlyOneInterpolationMarker(s string) bool {
	count := 0
	escaped := false

	for i := 0; i < len(s); i++ {
		// Check for escape character
		if s[i] == '\\' {
			escaped = true
			continue
		}

		// Check for ${ sequence when not escaped
		if !escaped && s[i] == '$' && i+2 < len(s) && s[i+1] == '{' && s[i+2] == '}' {
			count++
			i += 2 // Skip the next two characters ('{' and '}')
		}

		escaped = false
	}

	return count == 1
}

// IsValidGlobPattern checks if a string is a valid glob pattern
func IsValidGlobPattern(pattern string) bool {
	if pattern == "" {
		return false
	}

	// Check for invalid characters
	for _, c := range pattern {
		isLower := c >= 'a' && c <= 'z'
		isUpper := c >= 'A' && c <= 'Z'
		isDigit := c >= '0' && c <= '9'
		isSpecial := c == '_' || c == '-' || c == '*' || c == '.'
		if !isLower && !isUpper && !isDigit && !isSpecial {
			return false
		}
	}

	// Check for consecutive asterisks
	if strings.Contains(pattern, "**") {
		return false
	}

	return true
}

// MatchesGlobPattern checks if a value matches a glob pattern
func MatchesGlobPattern(value, pattern string) bool {
	if !IsValidGlobPattern(pattern) {
		return false
	}

	// Handle empty value
	if value == "" {
		return pattern == "*" || pattern == ""
	}

	// Handle exact match
	if !strings.Contains(pattern, "*") {
		return value == pattern
	}

	// Split pattern by asterisks
	parts := strings.Split(pattern, "*")

	// Handle single asterisk cases
	if len(parts) == 2 {
		// Prefix match: "v1*"
		if parts[1] == "" {
			return strings.HasPrefix(value, parts[0])
		}
		// Suffix match: "*v1"
		if parts[0] == "" {
			return strings.HasSuffix(value, parts[1])
		}
		// Contains match: "*v1*"
		if parts[0] == "" && parts[1] == "" {
			return true
		}
		// Middle match: "v1*v2"
		return strings.HasPrefix(value, parts[0]) && strings.HasSuffix(value, parts[1])
	}

	// Handle multiple asterisks
	lastIndex := 0
	for i, part := range parts {
		if part == "" {
			continue
		}

		if i == 0 {
			// First part must be a prefix
			if !strings.HasPrefix(value, part) {
				return false
			}
			lastIndex = len(part)
		} else if i == len(parts)-1 {
			// Last part must be a suffix
			if !strings.HasSuffix(value, part) {
				return false
			}
		} else {
			// Middle parts must be found in order
			index := strings.Index(value[lastIndex:], part)
			if index == -1 {
				return false
			}
			lastIndex += index + len(part)
		}
	}

	return true
}

func EnsureSuffix(s, suffix string) string {
	if strings.HasSuffix(s, suffix) {
		return s
	}
	return s + suffix
}
