---
name: unbind-create-release
description: >
  Create a tagged Unbind release. Checks the repo state, works out the next version, drafts
  three one-sentence summary options for the user to pick from, and only after approval
  creates the annotated tag, pushes it, arms a background monitor on the release workflow,
  and verifies the GitHub release and metadata entry once it finishes. Use when asked to
  create, tag, or publish a release, or "do it once more" / "again" after a previous release
  in the same session.
compatibility: Designed for Claude Code (or similar products)
metadata:
  author: Unbind
  version: "1.1"
  domain: release-management
  framework: Unbind
allowed-tools: Bash, AskUserQuestion, Monitor
---

# Unbind Release

A release is an annotated `vX.Y.Z` tag pushed to `origin`. Nothing else is done by hand.
`.github/workflows/release.yml` does the rest: builds the app, builder and operator images
for amd64 and arm64, pushes them to ghcr.io, builds the installer binaries, creates the
GitHub Release, and commits a `deploy/releases/metadata.json` entry to `master`.

The tag subject becomes the release **summary**. It is shown on every install's `/system/update`
page and is the first line of the GitHub Release body. A release without a summary fails.

**Never tag before the user has approved a summary.** Show three options first, always.

Every question to the user in this skill goes through `AskUserQuestion`, never plain
text. The user gets an option card with an automatic "Other" entry for free text.

## 1. Checks before proposing anything

Run all of this before proposing anything. Replace `<last>` with the newest tag.

```bash
git fetch origin -q
git status -sb                                   # must be clean; "behind N" is fine, pull later
git tag --sort=-v:refname | head -1              # <last>
git log --oneline <last>..origin/master          # what goes into the release
git diff --name-only <last> origin/master -- 'deploy/charts/charts/*/templates/**' \
  | grep -iE '(rbac|role|sa|serviceaccount)[^/]*\.yaml$' || echo "no RBAC changes"
git ls-tree -d origin/master deploy/releases/ | tail -3   # staged per-version manifests
grep -c '"<next>"' deploy/releases/metadata.json          # hand-written entry?
```

Decide the version:

- Default is the last tag with the patch bumped.
- If `deploy/releases/<version>/` exists on `origin/master` for a version newer than the
  last tag, a collaborator staged manifests for it. That version **is** the next release.
- The RBAC guard: if chart RBAC templates changed since the last tag, the workflow fails
  unless `deploy/releases/<next>/` exists. If it is missing, stop and tell the user. Do not
  create the directory yourself.

Things to surface to the user instead of working around:

- **Uncommitted changes** in the working tree. They will not be in the release. Say so,
  do not commit them, and continue with what is committed.
- **Nothing new** since the last tag. Ask with `AskUserQuestion` whether they still want an
  empty release ("Release anyway" / "Stop").
- **A breaking change.** `metadata.json` entries written by the workflow are always
  `breaking: false`. A breaking release needs a hand-written entry with `depends_on`
  before tagging. See `deploy/releases/README.md`. Point it out; do not write it unasked.
- **An existing `metadata.json` entry** for the next version. Its `summary` wins over the
  tag subject. Show it; the options below do not apply unless the user changes the entry.

## 2. Propose three summaries

Read the commit list and group it by feature, not by commit. Ignore the bot commits
(`releases: add metadata entry for ...`), lockfile bumps, and repo housekeeping unless
they are the only changes.

Write **three** candidate summaries. Rules for each:

- One sentence. Ends with a `.`.
- Comma-separated list of the main changes, most important first, `and` before the last.
  Match the tone of existing entries in `deploy/releases/metadata.json`.
- Plain words a user of Unbind understands. No commit prefixes, no file names, no
  internal component names unless the user would know them (PostgreSQL, GitHub, Railpack
  are fine; `staged-changes-bar` is not).
- Vary the three: one fuller (four or five items), one shorter (three items), one that
  leads with a different emphasis (for example the user-facing UI change first instead of
  the API change). Keep all three under about 25 words.

Example of the expected shape:

> PostgreSQL replication settings, GitHub watch path deployments, database backup
> scheduling and retention, optional resource limits, and service volume attachment
> improvements.

First print a short overview in plain text: the version, commit count, the main themes,
and anything the checks found. Then present the three summaries with **one**
`AskUserQuestion` call:

- `header`: `Summary`
- `question`: `Which summary should <next> use?`
- Three options. `label` is a two or three word handle (`Fuller`, `Shorter`, `UI first`),
  `description` is the full summary sentence, verbatim. Recommend one by listing it first
  with `(Recommended)` in its label.
- `multiSelect: false`. Do not add your own "write my own" option; the card already has
  "Other".

The chosen option's description, or the user's free text from "Other", is the approved
summary. If the user edits a summary in their answer, use their edit as is. Do not tag
until the answer is in.

## 3. Tag and push

```bash
git pull -q origin master                        # only if status showed "behind"
git log --oneline -1                             # must be the origin/master tip
git tag -a <next> -m "<approved summary>"
git push origin <next>
sleep 10
gh run list --workflow=release.yml --branch <next> --limit 1 \
  --json databaseId,status,url --jq '.[0]'       # <run-id>
```

Use the approved text verbatim, including the trailing `.`. Never use a lightweight tag.
If no run shows up after two tries ten seconds apart, check `gh run list --workflow=release.yml --limit 3`
and stop if the tag push did not trigger anything.

## 4. Arm a monitor, then end the turn

The workflow takes about five minutes. **Do not block on it.** Do not run `gh run watch`
or `sleep` in the foreground. Arm a `Monitor` that polls the run and emits one line when
it reaches a terminal state, then end your turn so the session is in monitoring mode:

```
Monitor({
  description: "release.yml run <run-id> for <next>",
  timeout_ms: 1800000,
  persistent: false,
  command: `
    while true; do
      out=$(gh run view <run-id> --json status,conclusion \
        --jq '"\(.status) \(.conclusion)"' 2>/dev/null) || { sleep 30; continue; }
      case "$out" in
        completed*) echo "release.yml run <run-id> for <next>: $out"; exit 0 ;;
      esac
      sleep 30
    done
  `,
})
```

The loop prints on every conclusion (`success`, `failure`, `cancelled`, `timed_out`), not
only success, and exits after the first terminal state. The transient `gh` failure path
keeps polling instead of killing the monitor.

After arming it, tell the user in one or two sentences that `<next>` is tagged and pushed,
give the run URL, and say you will verify when the workflow finishes. Then stop. Do not
poll, do not schedule wake-ups, do not re-check on your own; the monitor event brings you
back.

## 5. Verify when the monitor fires

The monitor notification is not a user message. When it arrives, verify all of this and
report it:

```bash
gh release view <next> --json name,isDraft,isPrerelease,assets,body \
  --jq '{name, isDraft, isPrerelease, assets: [.assets[].name], summaryLine: (.body | split("\n")[2])}'
git pull --ff-only -q origin master               # brings in the bot's metadata commit
git log --oneline -1 -- deploy/releases/metadata.json
git show HEAD:deploy/releases/metadata.json | grep -A3 '"<next>"'
git status -sb                                   # must not say "behind"
```

Expected: not a draft, not a prerelease, four installer assets
(`unbind-installer-{amd64,arm64}.gz` plus `.sha256`), the summary as the third line of the
body, and a `releases: add metadata entry for <next>` commit at the tip with the same
summary and `breaking: false`.

The pull is `--ff-only` on purpose: it never merges or rebases. If it refuses because of
local commits or uncommitted changes, leave the tree alone, verify against `origin/master`
instead (`git fetch origin master -q` then `git show origin/master:deploy/releases/metadata.json`)
and tell the user local `master` is still behind and why.

If the monitor timed out or the session restarted before it fired, check `gh run list`
before doing anything else; the release usually finished fine. Re-arm the monitor only if
the run is still in progress.

## 6. Report

State plainly: the version, that it is published, what was verified, and that local
`master` is up to date with `origin` again after the pull. If the pull was refused, say
local `master` is still one bot commit behind and why. If anything failed,
paste the failing step's output (`gh run view <run-id> --log-failed`) and stop. Do not
retry a failed tag push with a different version on your own.

## If the workflow fails

- **"has no summary"**: the tag was lightweight or the message was empty. Delete the
  tag locally and on origin, re-tag with `-a -m`, push again. Ask first with
  `AskUserQuestion`; deleting a remote tag is visible to everyone.
- **RBAC guard**: chart RBAC changed with no `deploy/releases/<next>/`. Tell the user;
  someone needs to stage manifests (or an empty `kustomization.yaml`) on `master` and the
  release must be re-tagged after that commit.
- **Metadata push conflict**: the workflow retries three times. If it still fails, the
  entry has to be added to `metadata.json` on `master` by hand.
