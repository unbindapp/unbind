# syntax=docker/dockerfile:1
#
# The build worker (ghcr.io/unbindapp/unbind-builder). Runs as a K8s Job to
# build user images via BuildKit/railpack. The binary is built on the CI runner
# and copied onto the prebuilt builder-base.

FROM unbindapp/builder-base:latest AS runtime
COPY apps/api/cmd/builder/builder /app/builder
CMD ["/app/builder"]
