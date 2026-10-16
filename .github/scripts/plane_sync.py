#!/usr/bin/env python3
"""Mirrors commit and pull request references into Plane.

"fixes UNB-123" (also closes/resolves) moves the work item to the project's
completed state and comments the link; "ref UNB-123" only comments. Comments
carry the commit sha or PR number as external_id, so re-runs do not repeat them."""
import json, os, re, sys, urllib.error, urllib.request

HOST = os.environ.get("PLANE_HOST", "https://plane.unbind.app")
WORKSPACE = os.environ.get("PLANE_WORKSPACE", "unbind")
KEY = os.environ["PLANE_API_KEY"]
CLOSE = re.compile(r"\b(?:fix|fixes|fixed|close|closes|closed|resolve|resolves|resolved)\s+(UNB-\d+)", re.I)
REF = re.compile(r"\b(?:ref|refs|see)\s+(UNB-\d+)", re.I)


def plane(method, path, body=None):
    req = urllib.request.Request(f"{HOST}/api/v1/{path}", method=method,
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers={"X-API-Key": KEY, "Content-Type": "application/json", "User-Agent": "plane-sync"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, json.load(resp)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(errors="replace")


def sources():
    event = json.load(open(os.environ["GITHUB_EVENT_PATH"]))
    repo_url = event["repository"]["html_url"]
    if os.environ["GITHUB_EVENT_NAME"] == "push":
        for c in event.get("commits", []):
            yield c["message"], f"{repo_url}/commit/{c['id']}", f"commit {c['id'][:10]}", c["id"]
        return
    pr = event.get("pull_request")
    if pr and pr.get("merged"):
        text = f"{pr.get('title') or ''}\n{pr.get('body') or ''}"
        yield text, pr["html_url"], f"PR #{pr['number']}", f"pr-{pr['number']}"


def completed_state(project_id):
    status, body = plane("GET", f"workspaces/{WORKSPACE}/projects/{project_id}/states/")
    states = body.get("results", body) if status == 200 else []
    done = [s for s in states if s["group"] == "completed"]
    named = [s for s in done if s["name"].lower() == "done"]
    return (named or done or [{}])[0].get("id")


def main():
    seen = set()
    for text, url, label, external_id in sources():
        closes = {m.upper() for m in CLOSE.findall(text)}
        refs = {m.upper() for m in REF.findall(text)} - closes
        for ident in closes | refs:
            if (ident, external_id) in seen:
                continue
            seen.add((ident, external_id))
            status, item = plane("GET", f"workspaces/{WORKSPACE}/issues/{ident}/")
            if status != 200:
                print(f"{ident}: not found ({status})")
                continue
            verb = "fixed by" if ident in closes else "referenced by"
            plane("POST", f"workspaces/{WORKSPACE}/projects/{item['project']}/issues/{item['id']}/comments/",
                  {"comment_html": f'<p>{verb} <a href="{url}">{label}</a></p>',
                   "external_source": "github", "external_id": f"{external_id}:{ident}"})
            if ident not in closes:
                print(f"{ident}: referenced by {label}")
                continue
            state = completed_state(item["project"])
            if not state:
                print(f"{ident}: no completed state in project")
                continue
            status, _ = plane("PATCH", f"workspaces/{WORKSPACE}/projects/{item['project']}/issues/{item['id']}/", {"state": state})
            print(f"{ident}: done by {label} ({status})")


if __name__ == "__main__":
    main()
