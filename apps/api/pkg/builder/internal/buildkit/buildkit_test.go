package buildkit

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDockerfileBuildArgs(t *testing.T) {
	dockerfile := `FROM node:22 AS builder
ARG NEXT_PUBLIC_SITE_URL
ARG MEILI_URL_INTERNAL=http://build.invalid
ARG A B=1
arg lowercase
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
RUN --mount=type=secret,id=SECRET_ONLY echo
`
	path := filepath.Join(t.TempDir(), "Dockerfile")
	require.NoError(t, os.WriteFile(path, []byte(dockerfile), 0o644))

	secrets := map[string]string{
		"NEXT_PUBLIC_SITE_URL": "https://example.com",
		"MEILI_URL_INTERNAL":   "http://meili:7700",
		"B":                    "2",
		"lowercase":            "yes",
		"SECRET_ONLY":          "hidden",
		"UNDECLARED":           "ignored",
	}

	attrs, err := dockerfileBuildArgs(path, secrets)
	require.NoError(t, err)
	assert.Equal(t, map[string]string{
		"build-arg:NEXT_PUBLIC_SITE_URL": "https://example.com",
		"build-arg:MEILI_URL_INTERNAL":   "http://meili:7700",
		"build-arg:B":                    "2",
		"build-arg:lowercase":            "yes",
	}, attrs)
}

func TestDockerfileBuildArgsMissingFile(t *testing.T) {
	_, err := dockerfileBuildArgs(filepath.Join(t.TempDir(), "missing"), nil)
	assert.Error(t, err)
}
