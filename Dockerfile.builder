# syntax=docker/dockerfile:1
#
# The build worker (ghcr.io/unbindapp/unbind-builder). Runs as a K8s Job to
# build user images via BuildKit/railpack; ships on the prebuilt builder-base.

FROM --platform=$BUILDPLATFORM golang:1.26 AS build
ARG TARGETARCH
ARG VERSION=development
WORKDIR /src
COPY apps/api/go.mod apps/api/go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
COPY apps/api/ ./
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOARCH=${TARGETARCH} go build \
    -ldflags "-s -w -X main.Version=${VERSION}" \
    -o /out/builder ./cmd/builder

FROM unbindapp/builder-base:latest AS runtime
COPY --from=build /out/builder /app/builder
CMD ["/app/builder"]
