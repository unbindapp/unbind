// Package names keeps display names unique among siblings
package names

import (
	"crypto/rand"
	"crypto/sha256"
	"fmt"
	"math/big"
	"slices"
	"strings"

	"github.com/unbindapp/unbind-api/internal/common/errdefs"
)

const (
	MaxLength = 32

	suffixLength   = 4
	suffixAttempts = 10

	randomCharset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	seededCharset = "abcdefghijklmnopqrstuvwxyz0123456789"
)

// Clean is the form a name is stored and compared in
func Clean(name string) (string, error) {
	cleaned := strings.TrimSpace(name)
	if cleaned == "" {
		return "", errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Name cannot be empty")
	}
	return cleaned, nil
}

func IsTaken(name string, taken []string) bool {
	return slices.Contains(taken, name)
}

// EnsureFree is for names the user typed, which are rejected rather than changed
func EnsureFree(name string, taken []string, kind, scope string) error {
	if !IsTaken(name, taken) {
		return nil
	}

	article := "A"
	if strings.ContainsRune("aeiouAEIOU", rune(kind[0])) {
		article = "An"
	}
	message := fmt.Sprintf("%s %s named \"%s\" already exists", article, kind, name)
	if scope != "" {
		message += " in this " + scope
	}
	return errdefs.NewCustomError(errdefs.ErrTypeConflict, message)
}

// Unique treats name as a suggestion: it is kept when free, else it gets a random suffix
func Unique(name string, taken []string, maxLength int) (string, error) {
	if !IsTaken(name, taken) {
		return name, nil
	}

	for range suffixAttempts {
		suffix, err := randomSuffix()
		if err != nil {
			return "", err
		}
		candidate := withSuffix(name, suffix, maxLength)
		if !IsTaken(candidate, taken) {
			return candidate, nil
		}
	}

	return "", errdefs.NewCustomError(errdefs.ErrTypeConflict, fmt.Sprintf("Could not find a free name for \"%s\"", name))
}

// UniqueSeeded is Unique for names that are computed on every read: the same seed gives the same suffix
func UniqueSeeded(name string, taken []string, maxLength int, seed string) string {
	candidate := name
	for attempt := 0; IsTaken(candidate, taken); attempt++ {
		candidate = withSuffix(name, seededSuffix(seed, attempt), maxLength)
	}
	return candidate
}

func withSuffix(name, suffix string, maxLength int) string {
	base := []rune(name)
	if limit := maxLength - suffixLength - 1; len(base) > limit {
		base = base[:limit]
	}
	return strings.TrimRight(string(base), "- ") + "-" + suffix
}

func randomSuffix() (string, error) {
	charsetLength := big.NewInt(int64(len(randomCharset)))
	suffix := make([]byte, suffixLength)
	for i := range suffix {
		index, err := rand.Int(rand.Reader, charsetLength)
		if err != nil {
			return "", err
		}
		suffix[i] = randomCharset[index.Int64()]
	}
	return string(suffix), nil
}

func seededSuffix(seed string, attempt int) string {
	sum := sha256.Sum256(fmt.Appendf(nil, "%s/%d", seed, attempt))
	suffix := make([]byte, suffixLength)
	for i := range suffix {
		suffix[i] = seededCharset[int(sum[i])%len(seededCharset)]
	}
	return string(suffix)
}
