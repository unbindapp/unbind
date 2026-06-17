package utils

import (
	"errors"
	"fmt"
	"net/url"
	"strings"

	"k8s.io/apimachinery/pkg/api/resource"
)

func ExtractRepoName(gitURL string) (string, error) {
	// Parse the URL
	u, err := url.Parse(gitURL)
	if err != nil || !u.IsAbs() || u.Scheme == "" || u.Host == "" {
		return "", errors.New("invalid URL format")
	}

	// Check if path is empty
	if u.Path == "" {
		return "", errors.New("no repository path found in URL")
	}

	// Clean the path and split
	cleanPath := strings.TrimSuffix(u.Path, ".git")
	cleanPath = strings.TrimPrefix(cleanPath, "/")
	parts := strings.Split(cleanPath, "/")

	// Ensure we have at least org/repo format
	if len(parts) < 2 {
		return "", errors.New("invalid repository path format")
	}

	// Get the repo name (last part)
	repoName := parts[len(parts)-1]
	if repoName == "" {
		return "", errors.New("empty repository name")
	}

	return repoName, nil
}

// validateStorageQuantity returns the parsed Quantity
// or an error if the string isn’t a whole-byte storage unit.
func ValidateStorageQuantity(s string) (resource.Quantity, error) {
	qty, err := resource.ParseQuantity(s)
	if err != nil {
		return resource.Quantity{}, fmt.Errorf("invalid resource quantity %q: %w", s, err)
	}

	switch qty.Format {
	case resource.BinarySI:
		// Gi, Mi, etc.
		return qty, nil

	case resource.DecimalSI:
		// Any negative scale (10^-n) means the user typed milli (`m`)
		// or some other fractional unit; treat that as CPU-only.
		if qty.AsDec().Scale() < 0 {
			return resource.Quantity{}, fmt.Errorf(
				"%q looks like a CPU value (milli units); use Ki, Mi, Gi, … or whole K/M/G for storage", s)
		}
		return qty, nil

	default:
		return resource.Quantity{}, fmt.Errorf(
			"%q uses scientific notation; disallowed for storage sizes", s)
	}
}

// validateStorageQuantity returns the parsed Quantity
// or an error if the string isn’t a whole-byte storage unit.
func ValidateStorageQuantityGB(sizeGB float64) (resource.Quantity, error) {
	s := fmt.Sprintf("%.2fGi", sizeGB)
	qty, err := resource.ParseQuantity(s)
	if err != nil {
		return resource.Quantity{}, fmt.Errorf("invalid resource quantity %q: %w", s, err)
	}

	switch qty.Format {
	case resource.BinarySI:
		// Gi, Mi, etc.
		return qty, nil

	case resource.DecimalSI:
		// Any negative scale (10^-n) means the user typed milli (`m`)
		// or some other fractional unit; treat that as CPU-only.
		if qty.AsDec().Scale() < 0 {
			return resource.Quantity{}, fmt.Errorf(
				"%q looks like a CPU value (milli units); use Ki, Mi, Gi, … or whole K/M/G for storage", s)
		}
		return qty, nil

	default:
		return resource.Quantity{}, fmt.Errorf(
			"%q uses scientific notation; disallowed for storage sizes", s)
	}
}
