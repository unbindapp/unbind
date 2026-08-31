import assert from "node:assert/strict";
import { test } from "node:test";

import { latestLogTimestamp, logLineKey } from "./log-utils.ts";

test("logLineKey uses timestamp, pod and message", () => {
  const key = logLineKey({ timestamp: "t", pod_name: "p", message: "m" });
  assert.equal(key, "t#p#m");
  assert.notEqual(key, logLineKey({ timestamp: "t", pod_name: "p", message: "m2" }));
});

test("logLineKey tolerates missing timestamp", () => {
  assert.equal(logLineKey({ pod_name: "p", message: "m" }), "#p#m");
});

test("latestLogTimestamp takes the newest line, not the last one", () => {
  const lines = [
    { timestamp: "2026-08-31T10:00:02Z" },
    { timestamp: "2026-08-31T10:00:05Z" },
    { timestamp: "2026-08-31T10:00:01Z" },
  ];
  assert.equal(latestLogTimestamp(null, lines), "2026-08-31T10:00:05Z");
});

test("latestLogTimestamp never moves backwards", () => {
  const current = "2026-08-31T10:00:05Z";
  assert.equal(latestLogTimestamp(current, [{ timestamp: "2026-08-31T10:00:01Z" }]), current);
  assert.equal(latestLogTimestamp(current, []), current);
});

test("latestLogTimestamp compares fractions numerically", () => {
  // as strings ".5Z" sorts above ".55Z", which would skip the newer line
  assert.equal(
    latestLogTimestamp("2026-08-31T10:00:00.5Z", [{ timestamp: "2026-08-31T10:00:00.55Z" }]),
    "2026-08-31T10:00:00.55Z",
  );
});

test("latestLogTimestamp returns the original string untouched", () => {
  const exact = "2026-08-31T10:00:00.123456789Z";
  assert.equal(latestLogTimestamp(null, [{ timestamp: exact }]), exact);
});

test("latestLogTimestamp skips lines without a usable timestamp", () => {
  const lines = [
    { timestamp: undefined },
    { timestamp: "nonsense" },
    { timestamp: "2026-08-31T10:00:03Z" },
  ];
  assert.equal(latestLogTimestamp(null, lines), "2026-08-31T10:00:03Z");
});
