package utils

import (
	"errors"
	"fmt"
	"math"
	"net/url"
	"strings"

	"k8s.io/apimachinery/pkg/api/resource"
)

const mebibyte = 1024 * 1024

// FormatStorageGB renders a GiB value as a Kubernetes quantity rounded to whole mebibytes, so the
// resulting byte count is always an integer (e.g. 2 -> "2Gi", 4.85 -> "4966Mi", 0.1 -> "102Mi").
// Fractional byte counts are rejected by storage admission webhooks that convert sizes with AsInt64.
func FormatStorageGB(gb float64) string {
	mib := int64(math.Round(gb * 1024))
	return resource.NewQuantity(mib*mebibyte, resource.BinarySI).String()
}

func ExtractRepoName(gitURL string) (string, error) {
	u, err := url.Parse(gitURL)
	if err != nil || !u.IsAbs() || u.Scheme == "" || u.Host == "" {
		return "", errors.New("invalid URL format")
	}

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

// ValidateStorageQuantity returns the parsed Quantity or an error if the string
// isn't a whole-byte storage unit.
func ValidateStorageQuantity(s string) (resource.Quantity, error) {
	qty, err := resource.ParseQuantity(s)
	if err != nil {
		return resource.Quantity{}, fmt.Errorf("invalid resource quantity %q: %w", s, err)
	}

	if _, ok := qty.AsInt64(); !ok {
		return resource.Quantity{}, fmt.Errorf(
			"%q is not a whole number of bytes; use whole Ki, Mi, Gi, … or K/M/G values for storage", s)
	}

	switch qty.Format {
	case resource.BinarySI, resource.DecimalSI:
		return qty, nil
	default:
		return resource.Quantity{}, fmt.Errorf(
			"%q uses scientific notation; disallowed for storage sizes", s)
	}
}

// ValidateStorageQuantityGB validates a GiB value after rounding it to whole mebibytes.
func ValidateStorageQuantityGB(sizeGB float64) (resource.Quantity, error) {
	return ValidateStorageQuantity(FormatStorageGB(sizeGB))
}
