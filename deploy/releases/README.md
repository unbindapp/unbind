# Releases

This directory is what a running Unbind reads to discover and apply in-app updates
(`apps/api/pkg/release`). A version is offered as an update only when **all** of these hold:

1. a `v*.*.*` git tag exists and `release.yml` has published its GitHub Release (images + installer built), and
2. `metadata.json` on `master` has an entry for that tag.

`release.yml` adds the entry to `master` itself when it is missing (`breaking: false`; the
description is the annotated tag message, or `Release <tag>` for lightweight tags). Only
breaking releases need the entry written by hand before tagging, so `depends_on` is set.

## metadata.json

```json
{
  "v0.1.1": {
    "version": "v0.1.1",
    "description": "Short summary shown nowhere yet — keep it for humans",
    "breaking": false
  },
  "v0.2.0": {
    "version": "v0.2.0",
    "description": "Requires a v0.1.x install",
    "breaking": true,
    "depends_on": ["v0.1.1"]
  }
}
```

- `breaking: true` without `depends_on` hides the version from every install.
- `depends_on` lists the versions an install must be on to jump to this one; the updater
  walks intermediate versions in order (`GetUpdatePath`).

## Per-version manifests (optional)

Put a flat `kustomization.yaml` (plus the files it references) under `deploy/releases/<tag>/`
to have extra Kubernetes resources applied before the images are retagged — e.g. a new RBAC
rule or ConfigMap the new version needs. The directory is read at the version's tag via the
GitHub contents API; subdirectories are ignored and the namespace is forced to the system
namespace. Versions without a directory just retag the `unbind` and `unbind-operator` images.
