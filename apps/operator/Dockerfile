# syntax=docker/dockerfile:1
#
# Runtime image for the operator manager. The binary is built on the CI runner
# (see build-operator.yml / release.yml) and copied onto distroless.
FROM gcr.io/distroless/static:nonroot
WORKDIR /
COPY apps/operator/manager .
USER 65532:65532

ENTRYPOINT ["/manager"]
