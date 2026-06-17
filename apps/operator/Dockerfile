# syntax=docker/dockerfile:1
# Build the manager binary.
#
# Built from the repository root context so the operator module compiles against
# the local apps/api module (replace github.com/unbindapp/unbind-api => ../api).
# The embedded service definitions in apps/api/pkg/databases link directly into
# the manager binary.
FROM --platform=$BUILDPLATFORM docker.io/golang:1.26 AS builder
ARG TARGETOS
ARG TARGETARCH

WORKDIR /workspace
# Module manifests first so source changes don't bust the cached download layer.
# apps/api is the replace target, so its go.mod must be present to resolve deps.
COPY apps/operator/go.mod apps/operator/go.sum apps/operator/
COPY apps/api/go.mod apps/api/go.sum apps/api/
WORKDIR /workspace/apps/operator
RUN --mount=type=cache,target=/go/pkg/mod go mod download

# Source for both modules.
WORKDIR /workspace
COPY apps/api/ apps/api/
COPY apps/operator/ apps/operator/

# Cross-compile for the target arch. No go.work in the context, so the replace
# directive drives resolution; -a is intentionally omitted.
WORKDIR /workspace/apps/operator
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=${TARGETOS:-linux} GOARCH=${TARGETARCH} go build -ldflags "-s -w" -o manager cmd/main.go

# Use distroless as minimal base image to package the manager binary
FROM gcr.io/distroless/static:nonroot
WORKDIR /
COPY --from=builder /workspace/apps/operator/manager .
USER 65532:65532

ENTRYPOINT ["/manager"]
