package utils

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// FindFiles recursively searches for files in rootDir that match the provided pattern.
// Pattern uses the same syntax as filepath.Match (e.g., "*.go", "config.*").
func FindFiles(rootDir string, pattern string) ([]string, error) {
	// First check if the pattern is valid to provide immediate feedback
	_, err := filepath.Match(pattern, "")
	if err != nil {
		return nil, fmt.Errorf("invalid pattern: %w", err)
	}

	var matches []string
	err = filepath.Walk(rootDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// Skip directories
		if info.IsDir() {
			return nil
		}

		// Check if file matches pattern
		matched, err := filepath.Match(pattern, filepath.Base(path))
		if err != nil {
			return err
		}

		if matched {
			// Use Unix-style path separators for consistency
			normPath := filepath.ToSlash(path)
			matches = append(matches, normPath)
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return matches, nil
}

// FindFilesWithExclusions is like FindFiles but allows excluding certain directories or patterns
func FindFilesWithExclusions(rootDir string, pattern string, excludeDirs []string) ([]string, error) {
	var matches []string

	err := filepath.Walk(rootDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// Check if current directory should be excluded
		if info.IsDir() {
			// Skip .git, node_modules, etc.
			if containsAny(path, excludeDirs) {
				return filepath.SkipDir
			}
			return nil
		}

		// Check if file matches pattern
		matched, err := filepath.Match(pattern, filepath.Base(path))
		if err != nil {
			return err
		}

		if matched {
			// Use Unix-style path separators for consistency
			normPath := filepath.ToSlash(path)
			matches = append(matches, normPath)
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return matches, nil
}

// Helper function to check if a path contains any of the excluded directories
func containsAny(path string, excludes []string) bool {
	for _, exclude := range excludes {
		if strings.Contains(path, exclude) {
			return true
		}
	}
	return false
}

// ReadFile reads the content of a file at the given path and returns it as a string.
// It handles potential errors and has a configurable maximum file size.
func ReadFile(path string) (string, error) {
	// Maximum file size to read (10MB by default)
	const maxSize = 10 * 1024 * 1024

	// Open the file
	file, err := os.Open(path)
	if err != nil {
		return "", fmt.Errorf("failed to open file %s: %w", path, err)
	}
	defer file.Close()

	// Get file info to check size
	info, err := file.Stat()
	if err != nil {
		return "", fmt.Errorf("failed to get file info for %s: %w", path, err)
	}

	// Check if file is too large
	if info.Size() > maxSize {
		return "", fmt.Errorf("file %s is too large (%d bytes), maximum allowed is %d bytes",
			path, info.Size(), maxSize)
	}

	// Read the file content
	content := make([]byte, info.Size())
	_, err = io.ReadFull(file, content)
	if err != nil {
		return "", fmt.Errorf("failed to read content from %s: %w", path, err)
	}

	return string(content), nil
}

// ReadFileWithLimit reads file content with a specified size limit
func ReadFileWithLimit(path string, maxSizeBytes int64) (string, error) {
	// Open the file
	file, err := os.Open(path)
	if err != nil {
		return "", fmt.Errorf("failed to open file %s: %w", path, err)
	}
	defer file.Close()

	// Get file info to check size
	info, err := file.Stat()
	if err != nil {
		return "", fmt.Errorf("failed to get file info for %s: %w", path, err)
	}

	// Check if file is too large
	if info.Size() > maxSizeBytes {
		return "", fmt.Errorf("file %s is too large (%d bytes), maximum allowed is %d bytes",
			path, info.Size(), maxSizeBytes)
	}

	// Read the file content
	content := make([]byte, info.Size())
	_, err = io.ReadFull(file, content)
	if err != nil {
		return "", fmt.Errorf("failed to read content from %s: %w", path, err)
	}

	return string(content), nil
}

// SafeReadFile attempts to read a file with proper error handling and defaults
func SafeReadFile(path string) (string, bool) {
	content, err := ReadFile(path)
	if err != nil {
		return "", false
	}
	return content, true
}

// IsTextFile checks if a file appears to be a text file rather than binary
func IsTextFile(path string) bool {
	// Read a small sample to check for binary content
	file, err := os.Open(path)
	if err != nil {
		return false
	}
	defer file.Close()

	// Read first 512 bytes to determine content type
	sample := make([]byte, 512)
	n, err := file.Read(sample)
	if err != nil && err != io.EOF {
		return false
	}

	// Shrink sample to actual size read
	sample = sample[:n]

	// Check for NULL bytes which likely indicate binary file
	for _, b := range sample {
		if b == 0 {
			return false
		}
	}

	// If no NULL bytes were found, it's likely a text file
	return true
}

// Returns true if the file exists
func FileExists(filename string) bool {
	_, err := os.Stat(filename)
	return err == nil
}
