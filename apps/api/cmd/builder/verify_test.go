package main

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestInternalImageRef(t *testing.T) {
	cases := map[string]struct {
		image string
		repo  string
		tag   string
		ok    bool
	}{
		"internal image":       {"docker-registry.unbind-system:5000/tezara:760f1a3b13d4-f44939710f2e", "tezara", "760f1a3b13d4-f44939710f2e", true},
		"nested repository":    {"docker-registry.unbind-system:5000/team/app:v1", "team/app", "v1", true},
		"external registry":    {"ghcr.io/acme/app:v1", "", "", false},
		"other namespace":      {"docker-registry.other:5000/app:v1", "", "", false},
		"internal without tag": {"docker-registry.unbind-system:5000/app", "", "", false},
	}

	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			repo, tag, ok := internalImageRef("unbind-system", tc.image)
			assert.Equal(t, tc.ok, ok)
			assert.Equal(t, tc.repo, repo)
			assert.Equal(t, tc.tag, tag)
		})
	}
}

func TestBuildVerifiedPushesAgainWhenTheRegistryRejectsMissingBlobs(t *testing.T) {
	calls := 0
	image, err := buildVerified(context.Background(), "unbind-system", func() (string, error) {
		calls++
		if calls == 1 {
			return "", errors.New("failed to push: unexpected status: 400 Bad Request: MANIFEST_BLOB_UNKNOWN: blob unknown to registry")
		}
		return "ghcr.io/acme/app:v1", nil
	})

	assert.NoError(t, err)
	assert.Equal(t, "ghcr.io/acme/app:v1", image)
	assert.Equal(t, 2, calls)
}

func TestBuildVerifiedDoesNotRetryOtherFailures(t *testing.T) {
	calls := 0
	_, err := buildVerified(context.Background(), "unbind-system", func() (string, error) {
		calls++
		return "", errors.New("dockerfile not found")
	})

	assert.Error(t, err)
	assert.Equal(t, 1, calls)
}
