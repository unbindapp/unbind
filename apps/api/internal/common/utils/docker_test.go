package utils

import (
	"sort"
	"testing"

	"github.com/stretchr/testify/assert"
)

// ! TODO - this test should probably just use some specific images that are known to have specific ports exposed
func TestGetExposedPortsFromRegistry(t *testing.T) {
	tests := []struct {
		name          string
		imageName     string
		expectedPorts []string
		expectError   bool
	}{
		{
			name:          "imgproxy test",
			imageName:     "darthsim/imgproxy:latest",
			expectedPorts: []string{"8080/tcp"},
			expectError:   false,
		},
		{
			name:          "nginx test",
			imageName:     "nginx:latest",
			expectedPorts: []string{"80/tcp"},
			expectError:   false,
		},
		{
			name:          "redis test",
			imageName:     "redis:latest",
			expectedPorts: []string{"6379/tcp"},
			expectError:   false,
		},
		{
			name:          "multiple ports test",
			imageName:     "postgres:latest",
			expectedPorts: []string{"5432/tcp"},
			expectError:   false,
		},
		{
			name:          "no ports test",
			imageName:     "alpine:latest",
			expectedPorts: []string{},
			expectError:   false,
		},
		{
			name:          "invalid image name",
			imageName:     "not/a/valid/image:???",
			expectedPorts: nil,
			expectError:   true,
		},
		{
			name:          "nonexistent image",
			imageName:     "nonexistent/imagename:latest",
			expectedPorts: nil,
			expectError:   true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			ports, err := GetExposedPortsFromRegistry(tc.imageName)

			// Check error expectation
			if tc.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}

			// If we expect specific ports, verify them
			if tc.expectedPorts != nil {
				// Sort both slices for deterministic comparison
				sort.Strings(ports)
				sort.Strings(tc.expectedPorts)
				assert.Equal(t, tc.expectedPorts, ports)
			}
		})
	}
}

// TestImageRegistryConnection tests that we can connect to Docker Hub
func TestImageRegistryConnection(t *testing.T) {
	_, err := GetExposedPortsFromRegistry("library/hello-world:latest")
	assert.NoError(t, err, "Should be able to connect to Docker Hub")
}

// TestActualImgproxy ensures darthsim/imgproxy actually has port 8080 exposed
func TestActualImgproxy(t *testing.T) {
	ports, err := GetExposedPortsFromRegistry("darthsim/imgproxy:latest")

	if assert.NoError(t, err) {
		assert.Contains(t, ports, "8080/tcp", "darthsim/imgproxy should expose port 8080")
	}
}
