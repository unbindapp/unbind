package osinfo

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/unbindapp/unbind-installer/internal/errdefs"
)

// Create a mock OS release file for testing
func createMockOSReleaseFile(t *testing.T, content string) *os.File {
	tmpFile, err := os.CreateTemp("", "os-release")
	require.NoError(t, err)

	_, err = tmpFile.WriteString(content)
	require.NoError(t, err)

	tmpFile.Seek(0, 0) // Reset file pointer to beginning
	return tmpFile
}

func TestGetOSInfo_NotLinux(t *testing.T) {
	// Save original function and restore after test
	origGetOoosFunc := getOoosFunc
	defer func() { getOoosFunc = origGetOoosFunc }()

	// Mock the OS detection to return Windows
	getOoosFunc = func() string { return "windows" }

	// Test that GetOSInfo returns the correct error for non-Linux systems
	info, err := GetOSInfo()

	// Assertions
	assert.Nil(t, info, "Expected nil info")
	assert.Error(t, err, "Expected error for non-Linux OS")
	assert.Contains(t, err.Error(), "Only linux is supported")

	customErr, ok := err.(*errdefs.CustomError)
	assert.True(t, ok, "Expected CustomError type")
	assert.Equal(t, errdefs.ErrTypeNotLinux, customErr.Type, "Wrong error type")
}

func TestGetOSInfo_SupportedUbuntu(t *testing.T) {
	// Save original functions and restore after test
	origGetOoosFunc := getOoosFunc
	origGetArchFunc := getArchFunc
	origOsOpen := osOpen
	defer func() {
		getOoosFunc = origGetOoosFunc
		getArchFunc = origGetArchFunc
		osOpen = origOsOpen
	}()

	// Mock OS detection to return Linux
	getOoosFunc = func() string { return "linux" }
	getArchFunc = func() string { return "amd64" }

	// Create a mock OS release file with valid Ubuntu 22.04 data
	content := `ID=ubuntu
VERSION_ID="22.04"
VERSION="22.04 LTS (Jammy Jellyfish)"
PRETTY_NAME="Ubuntu 22.04 LTS"
`
	tmpFile := createMockOSReleaseFile(t, content)
	defer os.Remove(tmpFile.Name())

	// Mock the file open function
	osOpen = func(name string) (*os.File, error) {
		if name == "/etc/os-release" {
			return tmpFile, nil
		}
		return os.Open(name)
	}

	// Test that GetOSInfo returns the correct information
	info, err := GetOSInfo()

	// Assertions
	assert.NoError(t, err, "Expected no error for supported Ubuntu distribution")
	require.NotNil(t, info, "Expected non-nil info")
	assert.Equal(t, "ubuntu", info.Distribution)
	assert.Equal(t, "22.04 LTS (Jammy Jellyfish)", info.Version)
	assert.Equal(t, "22.04", info.VersionID)
	assert.Equal(t, "Ubuntu 22.04 LTS", info.PrettyName)
	assert.Equal(t, "amd64", info.Architecture)
}

func TestGetOSInfo_SupportedUbuntu2404(t *testing.T) {
	// Save original functions and restore after test
	origGetOoosFunc := getOoosFunc
	origGetArchFunc := getArchFunc
	origOsOpen := osOpen
	defer func() {
		getOoosFunc = origGetOoosFunc
		getArchFunc = origGetArchFunc
		osOpen = origOsOpen
	}()

	// Mock OS detection to return Linux
	getOoosFunc = func() string { return "linux" }
	getArchFunc = func() string { return "amd64" }

	// Create a mock OS release file with valid Ubuntu 24.04 data
	content := `ID=ubuntu
VERSION_ID="24.04"
VERSION="24.04 LTS (Noble Numbat)"
PRETTY_NAME="Ubuntu 24.04 LTS"
`
	tmpFile := createMockOSReleaseFile(t, content)
	defer os.Remove(tmpFile.Name())

	// Mock the file open function
	osOpen = func(name string) (*os.File, error) {
		if name == "/etc/os-release" {
			return tmpFile, nil
		}
		return os.Open(name)
	}

	// Test that GetOSInfo returns the correct information
	info, err := GetOSInfo()

	// Assertions
	assert.NoError(t, err, "Expected no error for supported Ubuntu distribution")
	require.NotNil(t, info, "Expected non-nil info")
	assert.Equal(t, "ubuntu", info.Distribution)
	assert.Equal(t, "24.04 LTS (Noble Numbat)", info.Version)
	assert.Equal(t, "24.04", info.VersionID)
	assert.Equal(t, "Ubuntu 24.04 LTS", info.PrettyName)
	assert.Equal(t, "amd64", info.Architecture)
}

func TestGetOSInfo_UnsupportedDistribution(t *testing.T) {
	// Save original functions and restore after test
	origGetOoosFunc := getOoosFunc
	origGetArchFunc := getArchFunc
	origOsOpen := osOpen
	defer func() {
		getOoosFunc = origGetOoosFunc
		getArchFunc = origGetArchFunc
		osOpen = origOsOpen
	}()

	// Mock OS detection to return Linux
	getOoosFunc = func() string { return "linux" }
	getArchFunc = func() string { return "amd64" }

	// Create a mock OS release file with unsupported distribution
	content := `ID=fedora
VERSION_ID="38"
VERSION="38 (Workstation Edition)"
PRETTY_NAME="Fedora Linux 38 (Workstation Edition)"
`
	tmpFile := createMockOSReleaseFile(t, content)
	defer os.Remove(tmpFile.Name())

	// Mock the file open function
	osOpen = func(name string) (*os.File, error) {
		if name == "/etc/os-release" {
			return tmpFile, nil
		}
		return os.Open(name)
	}

	// Test that GetOSInfo returns the correct error
	info, err := GetOSInfo()

	// Assertions
	assert.Nil(t, info, "Expected nil info")
	assert.Error(t, err, "Expected error for unsupported distribution")

	customErr, ok := err.(*errdefs.CustomError)
	assert.True(t, ok, "Expected CustomError type")
	assert.Equal(t, errdefs.ErrTypeUnsupportedDistribution, customErr.Type, "Wrong error type")
	assert.Contains(t, err.Error(), "Unsupported distribution: fedora")
}

func TestGetOSInfo_UnsupportedVersion(t *testing.T) {
	// Save original functions and restore after test
	origGetOoosFunc := getOoosFunc
	origGetArchFunc := getArchFunc
	origOsOpen := osOpen
	defer func() {
		getOoosFunc = origGetOoosFunc
		getArchFunc = origGetArchFunc
		osOpen = origOsOpen
	}()

	// Mock OS detection to return Linux
	getOoosFunc = func() string { return "linux" }
	getArchFunc = func() string { return "amd64" }

	// Create a mock OS release file with unsupported Ubuntu version
	content := `ID=ubuntu
VERSION_ID="18.04"
VERSION="18.04 LTS (Bionic Beaver)"
PRETTY_NAME="Ubuntu 18.04 LTS"
`
	tmpFile := createMockOSReleaseFile(t, content)
	defer os.Remove(tmpFile.Name())

	// Mock the file open function
	osOpen = func(name string) (*os.File, error) {
		if name == "/etc/os-release" {
			return tmpFile, nil
		}
		return os.Open(name)
	}

	// Test that GetOSInfo returns the correct error
	info, err := GetOSInfo()

	// Assertions
	assert.Nil(t, info, "Expected nil info")
	assert.Error(t, err, "Expected error for unsupported version")

	customErr, ok := err.(*errdefs.CustomError)
	assert.True(t, ok, "Expected CustomError type")
	assert.Equal(t, errdefs.ErrTypeUnsupportedVersion, customErr.Type, "Wrong error type")
	assert.Contains(t, err.Error(), "Unsupported version: 18.04")
}

func TestGetOSInfo_MissingOSRelease(t *testing.T) {
	// Save original functions and restore after test
	origGetOoosFunc := getOoosFunc
	origGetArchFunc := getArchFunc
	origOsOpen := osOpen
	defer func() {
		getOoosFunc = origGetOoosFunc
		getArchFunc = origGetArchFunc
		osOpen = origOsOpen
	}()

	// Mock OS detection to return Linux
	getOoosFunc = func() string { return "linux" }
	getArchFunc = func() string { return "amd64" }

	// Mock the file open function to simulate missing file
	osOpen = func(name string) (*os.File, error) {
		if name == "/etc/os-release" {
			return nil, os.ErrNotExist
		}
		return os.Open(name)
	}

	// Test that GetOSInfo returns the correct error
	info, err := GetOSInfo()

	// Assertions
	assert.Nil(t, info, "Expected nil info")
	assert.Error(t, err, "Expected error for missing OS release file")

	customErr, ok := err.(*errdefs.CustomError)
	assert.True(t, ok, "Expected CustomError type")
	assert.Equal(t, errdefs.ErrTypeDistributionDetectionFailed, customErr.Type, "Wrong error type")
}

func TestGetOSInfo_EmptyDistribution(t *testing.T) {
	// Save original functions and restore after test
	origGetOoosFunc := getOoosFunc
	origGetArchFunc := getArchFunc
	origOsOpen := osOpen
	defer func() {
		getOoosFunc = origGetOoosFunc
		getArchFunc = origGetArchFunc
		osOpen = origOsOpen
	}()

	// Mock OS detection to return Linux
	getOoosFunc = func() string { return "linux" }
	getArchFunc = func() string { return "amd64" }

	// Create a mock OS release file with missing ID field
	content := `VERSION_ID="22.04"
VERSION="22.04 LTS (Jammy Jellyfish)"
PRETTY_NAME="Ubuntu 22.04 LTS"
`
	tmpFile := createMockOSReleaseFile(t, content)
	defer os.Remove(tmpFile.Name())

	// Mock the file open function
	osOpen = func(name string) (*os.File, error) {
		if name == "/etc/os-release" {
			return tmpFile, nil
		}
		return os.Open(name)
	}

	// Test that GetOSInfo returns the correct error
	info, err := GetOSInfo()

	// Assertions
	assert.Nil(t, info, "Expected nil info")
	assert.Error(t, err, "Expected error for empty distribution")
}
