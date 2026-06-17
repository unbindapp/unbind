package utils

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestInterpolationMarker(t *testing.T) {
	testCases := []struct {
		input    string
		expected bool
	}{
		{"Hello ${}", true},            // Contains exactly one instance
		{"Hello \\${}", false},         // Contains only an escaped instance
		{"Hello ${} and ${}", false},   // Contains two instances
		{"No markers here", false},     // Contains no instances
		{"Mix of \\${} and ${}", true}, // Contains one unescaped and one escaped
	}

	for _, tc := range testCases {
		result := ContainsExactlyOneInterpolationMarker(tc.input)
		assert.Equal(t, tc.expected, result, "Expected %t for input %s, but got %t", tc.expected, tc.input, result)
	}
}

func TestIsValidGlobPattern(t *testing.T) {
	tests := []struct {
		name     string
		pattern  string
		expected bool
	}{
		{
			name:     "Valid pattern without wildcard",
			pattern:  "v1",
			expected: true,
		},
		{
			name:     "Valid pattern with wildcard at end",
			pattern:  "v1*",
			expected: true,
		},
		{
			name:     "Valid pattern with wildcard at start",
			pattern:  "*v1",
			expected: true,
		},
		{
			name:     "Valid pattern with wildcard in middle",
			pattern:  "v1*v2",
			expected: true,
		},
		{
			name:     "Valid pattern with multiple wildcards",
			pattern:  "v1*v2*v3",
			expected: true,
		},
		{
			name:     "Valid pattern with underscore",
			pattern:  "v1_*",
			expected: true,
		},
		{
			name:     "Valid pattern with hyphen",
			pattern:  "v1-*",
			expected: true,
		},
		{
			name:     "Valid pattern with dot",
			pattern:  "v1.2*",
			expected: true,
		},
		{
			name:     "Empty pattern",
			pattern:  "",
			expected: false,
		},
		{
			name:     "Invalid character",
			pattern:  "v1@*",
			expected: false,
		},
		{
			name:     "Consecutive asterisks",
			pattern:  "v1**",
			expected: false,
		},
		{
			name:     "Complex valid pattern",
			pattern:  "v1-2_3.4*",
			expected: true,
		},
		{
			name:     "Only asterisk",
			pattern:  "*",
			expected: true,
		},
		{
			name:     "Space in pattern",
			pattern:  "v1 *",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := IsValidGlobPattern(tt.pattern)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestMatchesGlobPattern(t *testing.T) {
	tests := []struct {
		name     string
		value    string
		pattern  string
		expected bool
	}{
		// Exact matches
		{
			name:     "Exact match without wildcard",
			value:    "v1",
			pattern:  "v1",
			expected: true,
		},
		{
			name:     "No match without wildcard",
			value:    "v2",
			pattern:  "v1",
			expected: false,
		},
		// Prefix matches
		{
			name:     "Match with wildcard at end",
			value:    "v123",
			pattern:  "v1*",
			expected: true,
		},
		{
			name:     "Match with wildcard at end - exact prefix",
			value:    "v1",
			pattern:  "v1*",
			expected: true,
		},
		{
			name:     "No match with wildcard at end - different prefix",
			value:    "v2",
			pattern:  "v1*",
			expected: false,
		},
		// Suffix matches
		{
			name:     "Match with wildcard at start",
			value:    "abcv1",
			pattern:  "*v1",
			expected: true,
		},
		{
			name:     "Match with wildcard at start - exact suffix",
			value:    "v1",
			pattern:  "*v1",
			expected: true,
		},
		{
			name:     "No match with wildcard at start - different suffix",
			value:    "v2",
			pattern:  "*v1",
			expected: false,
		},
		// Contains matches
		{
			name:     "Match with wildcards on both sides",
			value:    "abcv1def",
			pattern:  "*v1*",
			expected: true,
		},
		{
			name:     "Match with wildcards on both sides - exact match",
			value:    "v1",
			pattern:  "*v1*",
			expected: true,
		},
		// Multiple wildcards
		{
			name:     "Match with multiple wildcards",
			value:    "v1abcv2def",
			pattern:  "v1*v2*",
			expected: true,
		},
		{
			name:     "Match with multiple wildcards - exact parts",
			value:    "v1v2",
			pattern:  "v1*v2*",
			expected: true,
		},
		{
			name:     "No match with multiple wildcards - wrong order",
			value:    "v2abcv1def",
			pattern:  "v1*v2*",
			expected: false,
		},
		// Complex patterns
		{
			name:     "Complex match with multiple wildcards",
			value:    "v1-2_3abcv4-5_6def",
			pattern:  "v1-2_3*v4-5_6*",
			expected: true,
		},
		{
			name:     "Complex no match with multiple wildcards",
			value:    "v1-2_4abcv4-5_6def",
			pattern:  "v1-2_3*v4-5_6*",
			expected: false,
		},
		// Edge cases
		{
			name:     "Empty value with wildcard",
			value:    "",
			pattern:  "v1*",
			expected: false,
		},
		{
			name:     "Empty value without wildcard",
			value:    "",
			pattern:  "v1",
			expected: false,
		},
		{
			name:     "Match with only asterisk",
			value:    "anything",
			pattern:  "*",
			expected: true,
		},
		{
			name:     "Match with only asterisk - empty value",
			value:    "",
			pattern:  "*",
			expected: true,
		},
		{
			name:     "Invalid pattern",
			value:    "v1",
			pattern:  "v1**",
			expected: false,
		},
		// Version-like patterns
		{
			name:     "Version pattern match",
			value:    "v1.2.3",
			pattern:  "v1.2*",
			expected: true,
		},
		{
			name:     "Version pattern no match",
			value:    "v1.3.3",
			pattern:  "v1.2*",
			expected: false,
		},
		{
			name:     "Version pattern with multiple wildcards",
			value:    "v1.2.3-beta",
			pattern:  "v1.2*beta*",
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := MatchesGlobPattern(tt.value, tt.pattern)
			assert.Equal(t, tt.expected, result)
		})
	}
}
