package utils

import (
	"errors"
	"fmt"
	"math"
	"net/url"
	"strconv"
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

// ParseStorageQuantity turns any storage size we accept into a whole-byte Kubernetes quantity.
// A bare number is a GiB amount (that is what the sliders and template inputs send), and anything
// that is not already a whole count of bytes is rounded to whole mebibytes: "10.1" and "10.1Gi"
// both become 10342Mi, and the legacy "0.25Gi" written by earlier template deploys becomes 256Mi.
// Unlike ValidateStorageQuantity this normalizes rather than rejects, because it also reads values
// that are already persisted.
func ParseStorageQuantity(s string) (resource.Quantity, error) {
	trimmed := strings.TrimSpace(s)
	if trimmed == "" {
		return resource.Quantity{}, errors.New("storage size is empty")
	}

	var qty resource.Quantity
	if gb, err := strconv.ParseFloat(trimmed, 64); err == nil {
		if math.IsNaN(gb) || math.IsInf(gb, 0) {
			return resource.Quantity{}, fmt.Errorf("invalid storage size %q", s)
		}
		qty = resource.MustParse(FormatStorageGB(gb))
	} else {
		parsed, err := resource.ParseQuantity(trimmed)
		if err != nil {
			return resource.Quantity{}, fmt.Errorf("invalid resource quantity %q: %w", s, err)
		}
		qty = parsed
	}

	// A quantity with a fractional unit ("0.25Gi") is not held as a whole byte count even when it
	// happens to be one, and storage admission webhooks convert sizes with AsInt64.
	if _, ok := qty.AsInt64(); !ok {
		mib := int64(math.Round(float64(qty.Value()) / mebibyte))
		qty = *resource.NewQuantity(mib*mebibyte, resource.BinarySI)
	}

	if qty.Sign() <= 0 {
		return resource.Quantity{}, fmt.Errorf("storage size %q must be greater than zero", s)
	}
	return ValidateStorageQuantity(qty.String())
}

// NormalizeStorageQuantity is ParseStorageQuantity rendered back to its canonical string form,
// which is what gets persisted and handed to Kubernetes.
func NormalizeStorageQuantity(s string) (string, error) {
	qty, err := ParseStorageQuantity(s)
	if err != nil {
		return "", err
	}
	return qty.String(), nil
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
