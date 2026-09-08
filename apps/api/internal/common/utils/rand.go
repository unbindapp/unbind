package utils

import (
	"crypto/rand"
	"fmt"
	"io"
	"math/big"
	"regexp"
	"strings"
)

// GenerateSecurePassword creates an alphanumeric password, safe to embed in URLs, DSNs and shell commands as-is
func GenerateSecurePassword(length int) (string, error) {
	const lowercase = "abcdefghijklmnopqrstuvwxyz"
	const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
	const numbers = "0123456789"
	const alphanumeric = lowercase + uppercase + numbers

	if length < 3 {
		return "", fmt.Errorf("password length must be at least 3")
	}

	password := make([]byte, length)

	letters := lowercase + uppercase
	letterIndex, err := randInt(int64(len(letters)))
	if err != nil {
		return "", err
	}
	password[0] = letters[letterIndex]

	upperIndex, err := randInt(int64(len(uppercase)))
	if err != nil {
		return "", err
	}
	upperPos, err := randInt(int64(length - 1))
	if err != nil {
		return "", err
	}
	upperPos += 1
	password[upperPos] = uppercase[upperIndex]

	for i := range password {
		if i == 0 || int64(i) == upperPos {
			continue
		}
		index, err := randInt(int64(len(alphanumeric)))
		if err != nil {
			return "", err
		}
		password[i] = alphanumeric[index]
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

	return GenerateSecurePassword(length)
}

func GenerateRandomSimpleID(length int) (string, error) {
	const charset = "abcdefghijklmnopqrstuvwxyz0123456789"
	charsetLength := big.NewInt(int64(len(charset)))

	result := make([]byte, length)

	// Fill the slice with random characters from the charset
	for i := range length {
		randomIndex, err := rand.Int(rand.Reader, charsetLength)
		if err != nil {
			return "", err
		}

		result[i] = charset[randomIndex.Int64()]
	}

	return string(result), nil
}

func GenerateSlug(displayName string) (string, error) {
	slug := strings.ToLower(displayName)

	// Replace non-alphanumeric characters with hyphens
	reg := regexp.MustCompile(`[^a-z0-9]+`)
	slug = reg.ReplaceAllString(slug, "-")

	slug = strings.Trim(slug, "-")

	// If slug is empty after cleaning, use a default
	if slug == "" {
		slug = "untitled"
	}

	shortID, err := GenerateRandomSimpleID(12)
	if err != nil {
		return "", err
	}

	return slug + "-" + shortID, nil
}
