# syntax=docker/dockerfile:1
#
# Runtime image for the merged app: the Go API serves the embedded SPA.
# The SPA bundle and Go binaries are built on the CI runner (see build-app.yml /
# release.yml) and copied in here, so this stage stays a thin package step.

FROM debian:bookworm-slim

# mise is pre-installed because the API's source analyzer execs it via railpack.
# MISE_VERSION is pinned to railpack's own version.txt at build time, so railpack
# finds the pre-seeded binary at /tmp/railpack/mise and never re-downloads it.
ARG MISE_VERSION
ARG MISE_DIR=/tmp/railpack/mise

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
    curl -fL -o "${MISE_DIR}/mise-${MISE_VERSION}" \
      "https://github.com/jdx/mise/releases/download/v${MISE_VERSION}/mise-v${MISE_VERSION}-${MISE_ASSET}" && \
    chmod +x "${MISE_DIR}/mise-${MISE_VERSION}" && \
    ln -sf "${MISE_DIR}/mise-${MISE_VERSION}" /usr/local/bin/mise && \
    apt-get purge -y --auto-remove curl && \
    rm -rf /var/lib/apt/lists/*

COPY apps/api/cmd/api/api /app/api
COPY apps/api/cmd/cli/cli /app/cli

EXPOSE 8089

CMD ["/app/api"]
