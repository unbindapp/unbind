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
    "description": "Short summary, shown on the update page",
    "release_notes": "Optional longer notes, also shown on the update page",
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
- `description` and `release_notes` are shown on the `/update` page for the latest
  available version.

## Per-version manifests (optional)

Put a flat `kustomization.yaml` (plus the files it references) under `deploy/releases/<tag>/`
to have extra Kubernetes resources applied before the images are retagged. The directory is
read at the version's tag via the GitHub contents API; subdirectories are ignored and the
kustomization's namespace is forced to the system namespace (cluster-scoped resources keep
their scope). Versions without a directory just retag the `unbind` and `unbind-operator`
images.

The rendered manifests are applied by a short-lived job running as the elevated
`unbind-updater-sa` service account (cluster-admin, created by the chart at install time),
so a release can ship cluster-scoped resources — ClusterRoles, CRDs — that the API's own
service account may not grant itself. The applier server-side-applies every document
(field manager `unbind-updater`) after a full dry-run pass, so an invalid bundle is
rejected before anything lands.

`release.yml` fails a tag whose chart RBAC templates changed since the previous release but
that ships no `deploy/releases/<tag>/` directory — the in-app updater never applies chart
templates, so such a change would silently miss existing installs. Ship the equivalent
grant as release manifests, or add an empty `kustomization.yaml` (no job is run for an
empty render) to acknowledge the change is fresh-install-only.
