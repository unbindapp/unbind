# CI build of the app and builder images, see .github/workflows/build-app.yml.
# The binaries they copy in must already be built, see .github/actions/build-app.

variable "TAG" {}
variable "MISE_VERSION" {}

group "default" {
  targets = ["app", "builder"]
}

# The inline cache lets the next build reuse the apt and mise layer from the
# image that was pushed last, with nothing extra to upload.
target "app" {
  dockerfile = "Dockerfile"
  tags       = ["ghcr.io/unbindapp/unbind:${TAG}"]
  args = {
    MISE_VERSION = MISE_VERSION
  }
  cache-from = ["type=registry,ref=ghcr.io/unbindapp/unbind:latest"]
  cache-to   = ["type=inline"]
}

target "builder" {
  dockerfile = "Dockerfile.builder"
  tags       = ["ghcr.io/unbindapp/unbind-builder:${TAG}"]
}
