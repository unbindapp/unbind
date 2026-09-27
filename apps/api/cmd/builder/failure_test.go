package main

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestBuildFailureReason(t *testing.T) {
	const host = "10.43.255.250:5000"

	tests := []struct {
		name     string
		err      error
		host     string
		expected string
	}{
		{
			name:     "registry rejects a blob upload",
			err:      errors.New("failed to solve: failed to push 10.43.255.250:5000/app:abc: unexpected status from PUT request to http://10.43.255.250:5000/v2/app/blobs/uploads/1: 500 Internal Server Error"),
			host:     host,
			expected: registryFullHint + " failed docker build failed to solve: failed to push 10.43.255.250:5000/app:abc: unexpected status from PUT request to http://10.43.255.250:5000/v2/app/blobs/uploads/1: 500 Internal Server Error",
		},
		{
			name:     "another registry fails",
			err:      errors.New("unexpected status from HEAD request to https://ghcr.io/v2/app/blobs/sha256:1: 500 Internal Server Error"),
			host:     host,
			expected: "failed docker build unexpected status from HEAD request to https://ghcr.io/v2/app/blobs/sha256:1: 500 Internal Server Error",
		},
		{
			name:     "build disk is full",
			err:      errors.New("failed to solve: write /var/lib/buildkit/runc/layer: no space left on device"),
			host:     host,
			expected: diskFullHint + " failed docker build failed to solve: write /var/lib/buildkit/runc/layer: no space left on device",
		},
		{
			name:     "unrelated failure",
			err:      errors.New("failed to solve: process \"npm run build\" did not complete successfully: exit code: 1"),
			host:     host,
			expected: "failed docker build failed to solve: process \"npm run build\" did not complete successfully: exit code: 1",
		},
		{
			name:     "no registry host",
			err:      errors.New("unexpected status from PUT request to http://registry/v2/app: 500 Internal Server Error"),
			host:     "",
			expected: "failed docker build unexpected status from PUT request to http://registry/v2/app: 500 Internal Server Error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, buildFailureReason("docker", tt.err, tt.host))
		})
	}
}
