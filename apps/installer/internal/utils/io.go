package utils

import (
	"crypto/sha256"
	"crypto/tls"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

// DownloadFile downloads a file from the given URL to the specified local path
func DownloadFile(filePath, url string) error {
	// Create the file
	out, err := os.Create(filePath)
	if err != nil {
		return fmt.Errorf("failed to create file %s: %w", filePath, err)
	}
	defer out.Close()

	// Get the data
	client := &http.Client{
		Timeout: 30 * time.Second,
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{
				MinVersion: tls.VersionTLS12,
			},
		},
	}

	resp, err := client.Get(url)
	if err != nil {
		return fmt.Errorf("failed to download %s: %w", url, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to download %s, status code: %d", url, resp.StatusCode)
	}

	// Write the body to file
	_, err = io.Copy(out, resp.Body)
	if err != nil {
		return fmt.Errorf("failed to write to file %s: %w", filePath, err)
	}

	return nil
}

// VerifyChecksum verifies the SHA256 checksum of a file
func VerifyChecksum(filePath, shaPath string) error {
	// Read the file
	fileData, err := os.ReadFile(filePath)
	if err != nil {
		return fmt.Errorf("failed to read file %s: %w", filePath, err)
	}

	// Calculate the SHA256 sum
	calculated := sha256.Sum256(fileData)
	calculatedHex := fmt.Sprintf("%x", calculated)

	// Read the expected checksum from the SHA file
	shaData, err := os.ReadFile(shaPath)
	if err != nil {
		return fmt.Errorf("failed to read SHA file %s: %w", shaPath, err)
	}

	// SHA256SUM files usually have the format: "<hash> <filename>"
	// We need to extract just the hash part
	shaContent := strings.TrimSpace(string(shaData))
	parts := strings.Fields(shaContent)

	var expectedHex string
	if len(parts) > 0 {
		// The first part should be the hash
		expectedHex = parts[0]
	} else {
		// Some SHA files might just contain the hash
		expectedHex = shaContent
	}

	// Compare the expected and calculated checksums
	if calculatedHex != expectedHex {
		return fmt.Errorf("checksum mismatch: expected %s, got %s", expectedHex, calculatedHex)
	}

	return nil
}
