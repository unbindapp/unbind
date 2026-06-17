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
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOARCH=${TARGETARCH} go build -trimpath \
    -ldflags "-s -w -X main.Version=${VERSION} -X main.BuildImage=${BUILD_IMAGE}" \
    -o /out/api ./cmd/api
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOARCH=${TARGETARCH} go build -trimpath \
    -ldflags "-s -w -X main.Version=${VERSION}" \
    -o /out/cli ./cmd/cli

# 3. Runtime. Slim Debian (glibc) base; mise is installed for railpack version
#    resolution (railpack execs it and otherwise auto-downloads it to this path).
FROM debian:bookworm-slim AS runtime

# Must match the version railpack pins (apps/api: railpack core/mise/version.txt),
# or railpack rejects this binary and re-downloads its expected version at runtime.
ARG MISE_VERSION=2026.6.10
ARG MISE_DIR=/tmp/railpack/mise
ARG MISE_BIN=${MISE_DIR}/mise-${MISE_VERSION}

RUN apt-get update && \
    apt-get install -y --no-install-recommends curl ca-certificates && \
    mkdir -p "${MISE_DIR}" && \
    ARCH="$(uname -m)"; \
    case "${ARCH}" in \
      x86_64)   MISE_ASSET="linux-x64"  ;; \
      aarch64|arm64) MISE_ASSET="linux-arm64" ;; \
      armv7l)   MISE_ASSET="linux-armv7" ;; \
      *) echo "Unsupported architecture: ${ARCH}" && exit 1 ;; \
    esac && \
    curl -L -o "${MISE_BIN}" \
      "https://github.com/jdx/mise/releases/download/v${MISE_VERSION}/mise-v${MISE_VERSION}-${MISE_ASSET}" && \
    chmod +x "${MISE_BIN}" && \
    ln -sf "${MISE_BIN}" /usr/local/bin/mise && \
    apt-get purge -y --auto-remove curl && \
    rm -rf /var/lib/apt/lists/*

COPY --from=build /out/api /app/api
COPY --from=build /out/cli /app/cli

EXPOSE 8089

CMD ["/app/api"]
