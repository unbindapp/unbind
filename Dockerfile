# syntax=docker/dockerfile:1
#
# Single image for the merged app: the Go API serves the embedded SPA.
# Builds the web bundle, embeds it into the API binary, ships a thin runtime.

# 1. Build the SPA (apps/web -> dist).
FROM --platform=$BUILDPLATFORM node:22 AS web
WORKDIR /web
COPY apps/web/package.json apps/web/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY apps/web/ ./
RUN npm run build

# 2. Build the Go binaries with the SPA embedded. Cross-compiles per TARGETARCH
#    so multi-arch builds never need emulation.
FROM --platform=$BUILDPLATFORM golang:1.26 AS build
ARG TARGETARCH
ARG VERSION=development
ARG BUILD_IMAGE=ghcr.io/unbindapp/unbind-builder:latest
WORKDIR /src
COPY apps/api/go.mod apps/api/go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
COPY apps/api/ ./
COPY --from=web /web/dist ./internal/web/dist
# Capture the exact mise version railpack pins, so the runtime stage pre-seeds the
# build railpack expects — no drift, no runtime re-download when railpack is bumped.
RUN --mount=type=cache,target=/go/pkg/mod \
    cp "$(go list -m -f '{{.Dir}}' github.com/railwayapp/railpack)/core/mise/version.txt" /mise-version
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOARCH=${TARGETARCH} go build -trimpath \
    -ldflags "-s -w -X main.Version=${VERSION} -X main.BuildImage=${BUILD_IMAGE}" \
    -o /out/api ./cmd/api
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOARCH=${TARGETARCH} go build -trimpath \
    -ldflags "-s -w -X main.Version=${VERSION}" \
    -o /out/cli ./cmd/cli

# 3. Runtime. Slim Debian (glibc) base. mise is pre-installed because the API's
#    source analyzer runs railpack provider plans (Plan -> InstallMisePackages ->
#    GetMisePackageVersions -> mise.New), which constructs and execs mise. Baking it
#    in avoids a ~90MB download on the first analysis of each pod and keeps source
#    detection working even when the pod can't reach GitHub at runtime.
#    The version is taken from railpack's own version.txt (captured in the build
#    stage), so it always matches the railpack compiled into the binary — railpack
#    finds the pre-seeded binary at /tmp/railpack/mise/mise-<version> and skips its
#    download. Pre-seed path mirrors railpack's getBinaryPath().
FROM debian:bookworm-slim AS runtime

ARG MISE_DIR=/tmp/railpack/mise
COPY --from=build /mise-version /tmp/mise-version

RUN apt-get update && \
    apt-get install -y --no-install-recommends curl ca-certificates && \
    MISE_VERSION="$(tr -d '[:space:]' < /tmp/mise-version)" && \
    mkdir -p "${MISE_DIR}" && \
    ARCH="$(uname -m)"; \
    case "${ARCH}" in \
      x86_64)   MISE_ASSET="linux-x64"  ;; \
      aarch64|arm64) MISE_ASSET="linux-arm64" ;; \
      armv7l)   MISE_ASSET="linux-armv7" ;; \
      *) echo "Unsupported architecture: ${ARCH}" && exit 1 ;; \
    esac && \
    curl -fL -o "${MISE_DIR}/mise-${MISE_VERSION}" \
      "https://github.com/jdx/mise/releases/download/v${MISE_VERSION}/mise-v${MISE_VERSION}-${MISE_ASSET}" && \
    chmod +x "${MISE_DIR}/mise-${MISE_VERSION}" && \
    ln -sf "${MISE_DIR}/mise-${MISE_VERSION}" /usr/local/bin/mise && \
    rm -f /tmp/mise-version && \
    apt-get purge -y --auto-remove curl && \
    rm -rf /var/lib/apt/lists/*

COPY --from=build /out/api /app/api
COPY --from=build /out/cli /app/cli

EXPOSE 8089

CMD ["/app/api"]
