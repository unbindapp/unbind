import assert from "node:assert/strict";
import { test } from "node:test";

import { buildLogStreamUrl } from "./log-stream-url.ts";

const base = {
  type: "service" as const,
  teamId: "team-1",
  projectId: "project-1",
  environmentId: "env-1",
  serviceId: "service-1",
  deploymentId: "deployment-1",
  start: "2026-08-31T10:00:00Z",
};

const apiUrl = "https://api.example.com";

function paramsOf(url: string): URLSearchParams {
  return new URL(url).searchParams;
}

test("builds a stream url on the api origin", () => {
  const url = buildLogStreamUrl(apiUrl, base, null);
  assert.ok(url.startsWith("https://api.example.com/logs/stream?"));
});

test("sends service_id only for the scopes that use it", () => {
  assert.equal(paramsOf(buildLogStreamUrl(apiUrl, base, null)).get("service_id"), "service-1");
  assert.equal(
    paramsOf(buildLogStreamUrl(apiUrl, { ...base, type: "deployment" }, null)).get("service_id"),
    "service-1",
  );
  assert.equal(
    paramsOf(buildLogStreamUrl(apiUrl, { ...base, type: "build" }, null)).get("service_id"),
    null,
  );
  assert.equal(
    paramsOf(buildLogStreamUrl(apiUrl, { ...base, type: "environment" }, null)).get("service_id"),
    null,
  );
});

test("sends deployment_id only for the scopes that use it", () => {
  assert.equal(
    paramsOf(buildLogStreamUrl(apiUrl, { ...base, type: "deployment" }, null)).get("deployment_id"),
    "deployment-1",
  );
  assert.equal(
    paramsOf(buildLogStreamUrl(apiUrl, { ...base, type: "build" }, null)).get("deployment_id"),
    "deployment-1",
  );
  assert.equal(paramsOf(buildLogStreamUrl(apiUrl, base, null)).get("deployment_id"), null);
});

test("keeps project and environment present but empty when unset", () => {
  const params = paramsOf(
    buildLogStreamUrl(apiUrl, { ...base, projectId: undefined, environmentId: undefined }, null),
  );
  assert.equal(params.get("project_id"), "");
  assert.equal(params.get("environment_id"), "");
});

test("omits filters that are empty", () => {
  const params = paramsOf(buildLogStreamUrl(apiUrl, base, null));
  assert.equal(params.get("search"), null);
  assert.equal(params.get("levels"), null);
  assert.equal(params.get("service_ids"), null);
});

test("forwards filters that are set", () => {
  const params = paramsOf(
    buildLogStreamUrl(
      apiUrl,
      { ...base, search: "level=error", levels: "error,warn", serviceIds: "a,b" },
      null,
    ),
  );
  assert.equal(params.get("search"), "level=error");
  assert.equal(params.get("levels"), "error,warn");
  assert.equal(params.get("service_ids"), "a,b");
});

test("resumes from the given position instead of the window start", () => {
  const params = paramsOf(buildLogStreamUrl(apiUrl, base, "2026-08-31T11:22:33.5Z"));
  assert.equal(params.get("start"), "2026-08-31T11:22:33.5Z");
});

test("falls back to the window start when there is nothing to resume from", () => {
  assert.equal(paramsOf(buildLogStreamUrl(apiUrl, base, null)).get("start"), base.start);
});

test("same inputs and resume position produce the same url", () => {
  // the url is the stream's identity: an unchanged query must not reconnect
  assert.equal(
    buildLogStreamUrl(apiUrl, base, "2026-08-31T11:00:00Z"),
    buildLogStreamUrl(apiUrl, base, "2026-08-31T11:00:00Z"),
  );
});
