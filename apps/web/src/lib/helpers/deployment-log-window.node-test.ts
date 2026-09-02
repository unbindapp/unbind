import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildLogsWindow, deployLogsAreFinal, deployLogsWindow } from "./deployment-log-window.ts";
import type { TDeploymentShallow } from "../queries/deployments.ts";

const MINUTE = 60 * 1000;
const GRACE = 2 * MINUTE;
const createdAt = Date.UTC(2026, 0, 1, 12, 0, 0);
const queuedAt = createdAt + MINUTE;
const startedAt = createdAt + 2 * MINUTE;

function deployment(overrides: Partial<TDeploymentShallow>): TDeploymentShallow {
  return {
    id: "d1",
    service_id: "s1",
    status: "active",
    created_at: new Date(createdAt).toISOString(),
    updated_at: new Date(createdAt).toISOString(),
    ...overrides,
  } as TDeploymentShallow;
}

describe("deployLogsAreFinal", () => {
  it("is final only when no pod can log anymore", () => {
    assert.equal(deployLogsAreFinal("removed"), true);
    assert.equal(deployLogsAreFinal("build-failed"), true);
    assert.equal(deployLogsAreFinal("build-cancelled"), true);
    assert.equal(deployLogsAreFinal("active"), false);
    assert.equal(deployLogsAreFinal("crashing"), false);
    assert.equal(deployLogsAreFinal("launch-error"), false);
    assert.equal(deployLogsAreFinal("build-running"), false);
  });
});

describe("deployLogsWindow", () => {
  it("anchors the start a grace before the deployment started", () => {
    const now = startedAt + 10 * MINUTE;
    assert.deepEqual(
      deployLogsWindow(
        deployment({
          queued_at: new Date(queuedAt).toISOString(),
          started_at: new Date(startedAt).toISOString(),
        }),
        now,
      ),
      { start: startedAt - GRACE },
    );
  });

  it("falls back to queued_at, then created_at", () => {
    const now = createdAt + 10 * MINUTE;
    assert.deepEqual(
      deployLogsWindow(deployment({ queued_at: new Date(queuedAt).toISOString() }), now),
      { start: queuedAt - GRACE },
    );
    assert.deepEqual(deployLogsWindow(deployment({}), now), { start: createdAt - GRACE });
  });

  it("stays live while a final status is inside the ingestion grace", () => {
    const removedAt = createdAt + 10 * MINUTE;
    const now = removedAt + MINUTE;
    assert.deepEqual(
      deployLogsWindow(
        deployment({ status: "removed", updated_at: new Date(removedAt).toISOString() }),
        now,
      ),
      { start: createdAt - GRACE, liveUntil: removedAt + GRACE },
    );
  });

  it("pins the end a grace after the final status landed", () => {
    const removedAt = createdAt + 10 * MINUTE;
    const now = removedAt + 3 * MINUTE;
    assert.deepEqual(
      deployLogsWindow(
        deployment({ status: "removed", updated_at: new Date(removedAt).toISOString() }),
        now,
      ),
      { start: createdAt - GRACE, end: removedAt + GRACE },
    );
  });
});

describe("buildLogsWindow", () => {
  it("is live from a grace before creation until the build completes", () => {
    assert.deepEqual(buildLogsWindow(deployment({}), createdAt + 10 * MINUTE), {
      start: createdAt - GRACE,
    });
  });

  it("stays live while completion is inside the ingestion grace", () => {
    const completedAt = createdAt + 10 * MINUTE;
    assert.deepEqual(
      buildLogsWindow(
        deployment({ completed_at: new Date(completedAt).toISOString() }),
        completedAt + MINUTE,
      ),
      { start: createdAt - GRACE, liveUntil: completedAt + GRACE },
    );
  });

  it("pins the end a grace after completion", () => {
    const completedAt = createdAt + 10 * MINUTE;
    assert.deepEqual(
      buildLogsWindow(
        deployment({ completed_at: new Date(completedAt).toISOString() }),
        completedAt + 3 * MINUTE,
      ),
      { start: createdAt - GRACE, end: completedAt + GRACE },
    );
  });
});
