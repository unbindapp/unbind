package osinfo

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestReadOSRelease(t *testing.T) {
	tests := []struct {
		name           string
		fileContent    string
		expectedDistro string
		expectedVer    string
		expectedVerID  string
		expectedPretty string
		shouldErr      bool
	}{
		{
			name: "Ubuntu 22.04",
			fileContent: `NAME="Ubuntu"
ID=ubuntu
VERSION_ID="22.04"
VERSION="22.04 LTS (Jammy Jellyfish)"
PRETTY_NAME="Ubuntu 22.04 LTS"`,
			expectedDistro: "ubuntu",
			expectedVer:    "22.04 LTS (Jammy Jellyfish)",
			expectedVerID:  "22.04",
			expectedPretty: "Ubuntu 22.04 LTS",
			shouldErr:      false,
		},
		{
			name: "Ubuntu 24.04",
			fileContent: `NAME="Ubuntu"
ID=ubuntu
VERSION_ID="24.04"
VERSION="24.04 LTS (Noble Numbat)"
PRETTY_NAME="Ubuntu 24.04 LTS"`,
			expectedDistro: "ubuntu",
			expectedVer:    "24.04 LTS (Noble Numbat)",
			expectedVerID:  "24.04",
			expectedPretty: "Ubuntu 24.04 LTS",
			shouldErr:      false,
		},
		{
			name:        "Empty file",
			fileContent: "",
			shouldErr:   false, // It should not error, but the values will be empty
		},
		{
			name: "Missing Version ID",
			fileContent: `NAME="Ubuntu"
ID=ubuntu
VERSION="22.04 LTS (Jammy Jellyfish)"
PRETTY_NAME="Ubuntu 22.04 LTS"`,
			expectedDistro: "ubuntu",
			expectedVer:    "22.04 LTS (Jammy Jellyfish)",
			expectedPretty: "Ubuntu 22.04 LTS",
			shouldErr:      false,
		},
		{
			name: "With extra values",
			fileContent: `NAME="Ubuntu"
ID=ubuntu
VERSION_ID="22.04"
VERSION="22.04 LTS (Jammy Jellyfish)"
PRETTY_NAME="Ubuntu 22.04 LTS"
EXTRA_KEY="Some value"
ANOTHER_KEY=value`,
			expectedDistro: "ubuntu",
			expectedVer:    "22.04 LTS (Jammy Jellyfish)",
			expectedVerID:  "22.04",
			expectedPretty: "Ubuntu 22.04 LTS",
			shouldErr:      false,
		},
		{
			name: "Malformed lines",
			fileContent: `NAME="Ubuntu"
ID=ubuntu
This is an incorrect line without equals
VERSION_ID="22.04"
VERSION="22.04 LTS (Jammy Jellyfish)"
=ThisIsIncorrectToo
PRETTY_NAME="Ubuntu 22.04 LTS"`,
			expectedDistro: "ubuntu",
			expectedVer:    "22.04 LTS (Jammy Jellyfish)",
			expectedVerID:  "22.04",
			expectedPretty: "Ubuntu 22.04 LTS",
			shouldErr:      false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// Create a temporary file with the test content
			tmpFile, err := os.CreateTemp("", "os-release-test")
			require.NoError(t, err)
			defer os.Remove(tmpFile.Name())

			_, err = tmpFile.WriteString(tc.fileContent)
			require.NoError(t, err)
			tmpFile.Close()

			// Replace os.Open with a function that returns our temporary file
			origOpen := osOpen
			defer func() { osOpen = origOpen }()

			osOpen = func(name string) (*os.File, error) {
				if name == "/etc/os-release" {
					return os.Open(tmpFile.Name())
				}
				return os.Open(name)
			}

			// Test the function
			info := &OSInfo{}
			err = readOSRelease(info)

			// Verify results
			if tc.shouldErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tc.expectedDistro, info.Distribution)
				assert.Equal(t, tc.expectedVer, info.Version)
				assert.Equal(t, tc.expectedVerID, info.VersionID)
				assert.Equal(t, tc.expectedPretty, info.PrettyName)
			}
		})
	}
}

func TestDetectLinuxDistro(t *testing.T) {
	tests := []struct {
		name           string
		mockFileExists bool
		fileContent    string
		expectedErr    bool
		expectedErrMsg string
	}{
		{
			name:           "Valid OS Release",
			mockFileExists: true,
			fileContent: `NAME="Ubuntu"
ID=ubuntu
VERSION_ID="22.04"
VERSION="22.04 LTS (Jammy Jellyfish)"
PRETTY_NAME="Ubuntu 22.04 LTS"`,
			expectedErr: false,
		},
		{
			name:           "Missing OS Release",
			mockFileExists: false,
			expectedErr:    true,
			expectedErrMsg: "Failed to detect Linux distribution",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// Setup for this test case
			var tmpFile *os.File
			var tmpFileName string

			if tc.mockFileExists {
				var err error
				tmpFile, err = os.CreateTemp("", "os-release-test")
				require.NoError(t, err)
				tmpFileName = tmpFile.Name()
				defer os.Remove(tmpFileName)

				_, err = tmpFile.WriteString(tc.fileContent)
				require.NoError(t, err)
				tmpFile.Close()
			}

			// Replace os.Open with a function that returns our expected behavior
			origOpen := osOpen
			defer func() { osOpen = origOpen }()

			osOpen = func(name string) (*os.File, error) {
				if name == "/etc/os-release" {
					if !tc.mockFileExists {
						return nil, os.ErrNotExist
					}
					return os.Open(tmpFileName)
				}
				return os.Open(name)
			}

			// Test the function
			info := &OSInfo{}
			err := detectLinuxDistro(info)

			// Verify results
			if tc.expectedErr {
				assert.Error(t, err)
				if tc.expectedErrMsg != "" {
					assert.Contains(t, err.Error(), tc.expectedErrMsg)
				}
			} else {
				assert.NoError(t, err)
			}
		})
	}
}
