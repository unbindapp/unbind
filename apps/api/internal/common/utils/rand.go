package utils

import (
	"crypto/rand"
	"fmt"
	"io"
	"math/big"
	"regexp"
	"strings"
)

// GenerateSecurePassword creates a password with the required constraints
func GenerateSecurePassword(length int, simple bool) (string, error) {
	const lowercase = "abcdefghijklmnopqrstuvwxyz"
	const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
	const numbers = "0123456789"
	const specialChars = "!@#$%^&*()_+-=[]{}|;:,.<>?"

	const alphanumeric = lowercase + uppercase + numbers
	const allChars = alphanumeric + specialChars

	if length < 3 {
		return "", fmt.Errorf("password length must be at least 3")
	}

	// Generate password
	password := make([]byte, length)

	// First character must be a letter
	letters := lowercase + uppercase
	letterIndex, err := randInt(int64(len(letters)))
	if err != nil {
		return "", err
	}
	password[0] = letters[letterIndex]

	if !simple {
		// Make sure at least one special character is included
		specialIndex, err := randInt(int64(len(specialChars)))
		if err != nil {
			return "", err
		}

		// Choose a random position for special char (not the first)
		specialPos, err := randInt(int64(length - 1))
		if err != nil {
			return "", err
		}
		// Add 1 to avoid position 0
		specialPos += 1
		password[specialPos] = specialChars[specialIndex]

		// Make sure at least one uppercase letter is included
		upperIndex, err := randInt(int64(len(uppercase)))
		if err != nil {
			return "", err
		}

		// Find a position for uppercase that isn't already taken
		var upperPos int64
		for attempts := 0; attempts < 10; attempts++ { // Limit attempts to avoid infinite loop
			pos, err := randInt(int64(length - 1))
			if err != nil {
				return "", err
			}
			// Add 1 to avoid position 0
			pos += 1

			// Check if this position is already used for special char
			if pos != specialPos {
				upperPos = pos
				break
			}

			// If we've tried several times and failed, just use a deterministic position
			if attempts == 9 {
				// Find the first available position that's not the special char position
				for i := 1; i < length; i++ {
					if int64(i) != specialPos {
						upperPos = int64(i)
						break
					}
				}
			}
		}

		password[upperPos] = uppercase[upperIndex]

		// Fill the rest with random characters
		for i := range password {
			// Skip positions that are already set
			if i == 0 || int64(i) == specialPos || int64(i) == upperPos {
				continue
			}

			index, err := randInt(int64(len(allChars)))
			if err != nil {
				return "", err
			}
			password[i] = allChars[index]
		}
	} else {
		// For simple passwords, just use alphanumeric characters
		// Make sure at least one uppercase letter is included
		upperIndex, err := randInt(int64(len(uppercase)))
		if err != nil {
			return "", err
		}

		// Choose a random position for uppercase (not the first)
		upperPos, err := randInt(int64(length - 1))
		if err != nil {
			return "", err
		}
		// Add 1 to avoid position 0
		upperPos += 1
		password[upperPos] = uppercase[upperIndex]

		// Fill the rest with random alphanumeric characters
		for i := range password {
			// Skip positions that are already set
			if i == 0 || int64(i) == upperPos {
				continue
			}

			index, err := randInt(int64(len(alphanumeric)))
			if err != nil {
				return "", err
			}
			password[i] = alphanumeric[index]
		}
	}

	return string(password), nil
}

// randInt generates a random integer between 0 and max-1
func randInt(max int64) (int64, error) {
	if max <= 0 {
		return 0, fmt.Errorf("max must be positive")
	}

	n, err := rand.Int(rand.Reader, big.NewInt(max))
	if err != nil {
		return 0, err
	}

	return n.Int64(), nil
}

// For testing purposes, this function allows overriding the random source
func generateSecurePasswordWithRand(length int, reader io.Reader) (string, error) {
	// Save original rand.Reader
	origReader := rand.Reader
	defer func() {
		rand.Reader = origReader
	}()

	// Override rand.Reader for this function call
	rand.Reader = reader

	return GenerateSecurePassword(length, false)
}

func GenerateRandomSimpleID(length int) (string, error) {
	const charset = "abcdefghijklmnopqrstuvwxyz0123456789"
	charsetLength := big.NewInt(int64(len(charset)))

	result := make([]byte, length)

	// Fill the slice with random characters from the charset
	for i := 0; i < length; i++ {
		randomIndex, err := rand.Int(rand.Reader, charsetLength)
		if err != nil {
			return "", err
		}

		result[i] = charset[randomIndex.Int64()]
	}

	return string(result), nil
}

func GenerateSlug(displayName string) (string, error) {
	// Convert to lowercase
	slug := strings.ToLower(displayName)

	// Replace non-alphanumeric characters with hyphens
	reg := regexp.MustCompile(`[^a-z0-9]+`)
	slug = reg.ReplaceAllString(slug, "-")

	// Trim leading and trailing hyphens
	slug = strings.Trim(slug, "-")

	// If slug is empty after cleaning, use a default
	if slug == "" {
		slug = "untitled"
	}

	// Generate a random short ID
	shortID, err := GenerateRandomSimpleID(12)
	if err != nil {
		return "", err
	}

	// Combine slug and short ID
	return slug + "-" + shortID, nil
}
