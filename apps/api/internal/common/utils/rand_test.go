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
		for i := 0; i < 100; i++ {
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

	for i := 0; i < numSlugs; i++ {
		slug, err := GenerateSlug(displayName)
		assert.NoError(t, err)
		slugs[i] = slug
	}

	// Check that all generated slugs are unique
	for i := 0; i < numSlugs; i++ {
		for j := i + 1; j < numSlugs; j++ {
			assert.NotEqual(t, slugs[i], slugs[j], "Generated slugs should be unique")
		}
	}
}

func TestGenerateSecurePassword(t *testing.T) {
	// Test complex passwords (with special characters)
	t.Run("complex passwords", func(t *testing.T) {
		for i := 0; i < 100; i++ { // Run multiple times to ensure consistency
			length := 12
			password, err := GenerateSecurePassword(length, false)
			if err != nil {
				t.Errorf("unexpected error: %v", err)
			}
			if len(password) != length {
				t.Errorf("expected password length %d, got %d", length, len(password))
			}

			// Verify password requirements
			hasUpper := false
			hasSpecial := false
			hasAlphaNumeric := false
			firstIsLetter := false

			for i, c := range password {
				char := string(c)

				if strings.ContainsAny(char, "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
					hasUpper = true
				}

				if strings.ContainsAny(char, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789") {
					hasAlphaNumeric = true
				}

				if strings.ContainsAny(char, "!@#$%^&*()_+-=[]{}|;:,.<>?") {
					hasSpecial = true
				}

				// Check if first character is a letter
				if i == 0 && strings.ContainsAny(char, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ") {
					firstIsLetter = true
				}
			}

			if !hasUpper {
				t.Error("password missing uppercase letter")
			}
			if !hasSpecial {
				t.Error("password missing special character")
			}
			if !hasAlphaNumeric {
				t.Error("password missing alphanumeric character")
			}
			if !firstIsLetter {
				t.Error("first character is not a letter")
			}
		}
	})

	// Test simple passwords (alphanumeric only)
	t.Run("simple passwords", func(t *testing.T) {
		for i := 0; i < 100; i++ { // Run multiple times to ensure consistency
			length := 12
			password, err := GenerateSecurePassword(length, true)
			if err != nil {
				t.Errorf("unexpected error: %v", err)
			}
			if len(password) != length {
				t.Errorf("expected password length %d, got %d", length, len(password))
			}

			// Verify password requirements
			hasUpper := false
			hasAlphaNumeric := false
			firstIsLetter := false
			hasSpecial := false

			for i, c := range password {
				char := string(c)

				if strings.ContainsAny(char, "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
					hasUpper = true
				}

				if strings.ContainsAny(char, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789") {
					hasAlphaNumeric = true
				}

				if strings.ContainsAny(char, "!@#$%^&*()_+-=[]{}|;:,.<>?") {
					hasSpecial = true
				}

				// Check if first character is a letter
				if i == 0 && strings.ContainsAny(char, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ") {
					firstIsLetter = true
				}
			}

			if !hasUpper {
				t.Error("password missing uppercase letter")
			}
			if !hasAlphaNumeric {
				t.Error("password missing alphanumeric character")
			}
			if !firstIsLetter {
				t.Error("first character is not a letter")
			}
			if hasSpecial {
				t.Error("simple password should not contain special characters")
			}
		}
	})

	t.Run("random source never duplicates", func(t *testing.T) {
		results := make(map[string]bool)
		for i := 0; i < 100; i++ {
			password, err := GenerateSecurePassword(12, false)
			assert.NoError(t, err)
			assert.NotContains(t, results, password)
			results[password] = true
		}
	})

	// Test with a mocked random source for deterministic testing
	t.Run("mocked random source", func(t *testing.T) {
		// Create a deterministic random source for testing
		mockRand := &mockRandReader{
			values: []byte{
				5,                              // First alphanumeric (index into alphanumeric)
				10,                             // Special char index
				2,                              // Special position (will be +1 to avoid first position)
				7,                              // Uppercase index
				4,                              // Uppercase position (will try this, may need to find another)
				20, 30, 40, 50, 60, 70, 80, 90, // Values for remaining positions
			},
		}

		password, err := generateSecurePasswordWithRand(8, mockRand)
		if err != nil {
			t.Errorf("unexpected error: %v", err)
		}

		if len(password) != 8 {
			t.Errorf("expected password length 8, got %d", len(password))
		}

		assert.Equal(t, "fuE_OHY8", password)
	})

	// Test error cases
	t.Run("error cases", func(t *testing.T) {
		// Test too short password
		_, err := GenerateSecurePassword(2, false)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "password length must be at least 3")

		// Test too short password with simple mode
		_, err = GenerateSecurePassword(2, true)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "password length must be at least 3")
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
