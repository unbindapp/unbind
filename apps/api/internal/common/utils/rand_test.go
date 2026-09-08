package utils

import (
	"regexp"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGenerateRandomSimpleID(t *testing.T) {
	t.Run("generates string of correct length", func(t *testing.T) {
		length := 5
		result, err := GenerateRandomSimpleID(length)

		require.NoError(t, err)
		assert.Equal(t, length, len(result), "Generated string should be of the requested length")
	})

	t.Run("generates only lowercase alphanumeric characters", func(t *testing.T) {
		result, err := GenerateRandomSimpleID(5)

		require.NoError(t, err)
		matched, err := regexp.MatchString("^[a-z0-9]+$", result)
		require.NoError(t, err, "Regex matching error")
		assert.True(t, matched, "String should only contain lowercase letters and numbers")
	})

	t.Run("generates different strings on consecutive calls", func(t *testing.T) {
		// Generate multiple strings and ensure they're different
		results := make(map[string]bool)

		// Generate 100 strings to have a statistically significant sample
		for range 100 {
			str, err := GenerateRandomSimpleID(5)
			require.NoError(t, err)
			results[str] = true
		}

		// If truly random, we should have close to 100 unique strings
		// We use a lower bound to account for possible collisions
		assert.Greater(t, len(results), 95, "Should generate mostly unique strings")
	})

	t.Run("handles zero length", func(t *testing.T) {
		result, err := GenerateRandomSimpleID(0)

		require.NoError(t, err)
		assert.Equal(t, "", result, "Zero length should return empty string")
	})

	t.Run("handles large length", func(t *testing.T) {
		length := 1000
		result, err := GenerateRandomSimpleID(length)

		require.NoError(t, err)
		assert.Equal(t, length, len(result), "Should handle large requested lengths")
	})
}

func TestGenerateSlug(t *testing.T) {
	tests := []struct {
		name        string
		displayName string
		wantPattern string
	}{
		{
			name:        "Simple name",
			displayName: "New Project",
			wantPattern: "^new-project-[a-z0-9]{12}$",
		},
		{
			name:        "Name with special characters",
			displayName: "Hello World! @#$ 123",
			wantPattern: "^hello-world-123-[a-z0-9]{12}$",
		},
		{
			name:        "Name with multiple spaces",
			displayName: "  Multiple   Spaces  ",
			wantPattern: "^multiple-spaces-[a-z0-9]{12}$",
		},
		{
			name:        "Empty string",
			displayName: "",
			wantPattern: "^untitled-[a-z0-9]{12}$",
		},
		{
			name:        "Non-ASCII characters",
			displayName: "Café Résumé",
			wantPattern: "^caf-r-sum-[a-z0-9]{12}$",
		},
		{
			name:        "Only special characters",
			displayName: "!@#$%^&*()",
			wantPattern: "^untitled-[a-z0-9]{12}$",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := GenerateSlug(tt.displayName)

			// Assert no error occurred
			assert.NoError(t, err)

			// Assert the slug matches the expected pattern
			assert.Regexp(t, regexp.MustCompile(tt.wantPattern), got)
		})
	}
}

func TestGenerateSlugUniqueness(t *testing.T) {
	// Generate multiple slugs from the same name
	displayName := "Test Project"
	numSlugs := 10
	slugs := make([]string, numSlugs)

	for i := range numSlugs {
		slug, err := GenerateSlug(displayName)
		assert.NoError(t, err)
		slugs[i] = slug
	}

	// Check that all generated slugs are unique
	for i := range numSlugs {
		for j := i + 1; j < numSlugs; j++ {
			assert.NotEqual(t, slugs[i], slugs[j], "Generated slugs should be unique")
		}
	}
}

func TestGenerateSecurePassword(t *testing.T) {
	alphanumeric := regexp.MustCompile(`^[a-zA-Z][a-zA-Z0-9]*$`)

	t.Run("alphanumeric with uppercase", func(t *testing.T) {
		for range 100 {
			password, err := GenerateSecurePassword(32)
			require.NoError(t, err)
			assert.Len(t, password, 32)
			assert.Regexp(t, alphanumeric, password)
			assert.NotEqual(t, strings.ToLower(password), password, "password missing uppercase letter")
		}
	})

	t.Run("random source never duplicates", func(t *testing.T) {
		results := make(map[string]bool)
		for range 100 {
			password, err := GenerateSecurePassword(12)
			require.NoError(t, err)
			assert.NotContains(t, results, password)
			results[password] = true
		}
	})

	t.Run("mocked random source", func(t *testing.T) {
		mockRand := &mockRandReader{
			values: []byte{5, 7, 4, 20, 30, 40, 50, 60, 70, 80, 90},
		}

		password, err := generateSecurePasswordWithRand(8, mockRand)
		require.NoError(t, err)
		assert.Equal(t, "fuEOYH8g", password)
	})

	t.Run("too short", func(t *testing.T) {
		_, err := GenerateSecurePassword(2)
		assert.ErrorContains(t, err, "password length must be at least 3")
	})
}

// Better mockRandReader for testing
type mockRandReader struct {
	values []byte
	index  int
}

func (m *mockRandReader) Read(p []byte) (n int, err error) {
	for i := range p {
		if m.index >= len(m.values) {
			m.index = 0
		}
		p[i] = m.values[m.index]
		m.index++
	}
	return len(p), nil
}
