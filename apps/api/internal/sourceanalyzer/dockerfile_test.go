package sourceanalyzer

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/unbindapp/unbind-api/internal/sourceanalyzer/enum"
)

const rustCargoToml = `[package]
name = "server"
version = "0.1.0"
edition = "2021"
`

func TestAnchoredDockerfileFollowsFinalStage(t *testing.T) {
	root := writeFixture(t, map[string]string{
		"Dockerfile": `FROM oven/bun:1 AS web
WORKDIR /app/apps/web
COPY apps/web/package.json ./
COPY apps/web ./
RUN bun run build

FROM rust:1.98-bookworm AS chef
WORKDIR /app/apps/server

FROM chef AS server
COPY apps/server ./
COPY --from=web /app/apps/web/dist /app/apps/web/dist
RUN cargo build --release

FROM debian:bookworm-slim
COPY --from=server /app/apps/server/target/release/server /usr/local/bin/server
CMD ["server"]
`,
		"apps/web/package.json":   nextPackageJSON,
		"apps/server/Cargo.toml":  rustCargoToml,
		"apps/server/src/main.rs": "fn main() {}\n",
	})

	res, err := AnalyzeSourceCodeAnchored(root, AnalysisTarget{})
	require.NoError(t, err)
	assert.Equal(t, enum.Rust, res.Provider)
	assert.Equal(t, "rust", res.Icon("github"))
}

func TestAnchoredDockerfileCopiedFileUsesItsFolder(t *testing.T) {
	root := writeFixture(t, map[string]string{
		"docker/api.Dockerfile": `FROM rust:1 AS build
COPY services/api/Cargo.toml ./
COPY services/api/src ./src
RUN cargo build --release

FROM debian:bookworm-slim
COPY --from=0 /target/release/api /api
`,
		"services/api/Cargo.toml":   rustCargoToml,
		"services/api/src/main.rs":  "fn main() {}\n",
		"services/web/package.json": nextPackageJSON,
	})

	res, err := AnalyzeSourceCodeAnchored(root, AnalysisTarget{DockerfilePath: "docker/api.Dockerfile"})
	require.NoError(t, err)
	assert.Equal(t, enum.Rust, res.Provider)
}

func TestAnchoredDockerfileFallsBackToBaseImage(t *testing.T) {
	root := writeFixture(t, map[string]string{
		"Dockerfile": `FROM node:22 AS unused
COPY services/web ./

FROM golang:1.23 AS build
WORKDIR /src
COPY . .
RUN cd services/api && go build -o /api

FROM gcr.io/distroless/static
COPY --from=build /api /api
`,
		"services/api/go.mod":       "module api\n\ngo 1.23\n",
		"services/web/package.json": nextPackageJSON,
	})

	res, err := AnalyzeSourceCodeAnchored(root, AnalysisTarget{})
	require.NoError(t, err)
	assert.Equal(t, enum.Go, res.Provider)
	assert.Equal(t, enum.UnknownFramework, res.Framework)
}

func TestAnchoredDockerfileNothingDetected(t *testing.T) {
	root := writeFixture(t, map[string]string{
		"Dockerfile":     "FROM alpine:3\nCOPY scripts ./scripts\nCMD [\"./scripts/run.sh\"]\n",
		"scripts/run.sh": "#!/bin/sh\necho hi\n",
	})

	res, err := AnalyzeSourceCodeAnchored(root, AnalysisTarget{})
	require.NoError(t, err)
	assert.Equal(t, enum.UnknownProvider, res.Provider)
}

func TestBaseImageProvider(t *testing.T) {
	cases := map[string]enum.Provider{
		"rust:1.98-bookworm":               enum.Rust,
		"docker.io/library/golang:1.23":    enum.Go,
		"oven/bun:1":                       enum.Bun,
		"mcr.microsoft.com/dotnet/sdk:8.0": enum.Dotnet,
		"someone/node:20":                  enum.UnknownProvider,
		"debian:bookworm-slim":             enum.UnknownProvider,
		"${BASE_IMAGE}":                    enum.UnknownProvider,
	}
	for image, want := range cases {
		assert.Equal(t, want, baseImageProvider(image), "image: %s", image)
	}
}
