import assert from "node:assert/strict";
import { test } from "node:test";

import {
  latestLogTimestamp,
  logLineKey,
  logLineRef,
  matchesLogLineRef,
  nearestLogLineIndex,
  parseLogLineRef,
} from "./log-utils.ts";

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

test("log line refs round trip, keeping nanosecond timestamps intact", () => {
  const line = { timestamp: "2026-08-31T10:00:00.123456789Z", pod_name: "web-7f9c4-abcde" };
  const ref = parseLogLineRef(logLineRef(line));
  assert.deepEqual(ref, { timestamp: line.timestamp, podName: line.pod_name });
  assert.ok(matchesLogLineRef(ref!, line));
  assert.ok(!matchesLogLineRef(ref!, { ...line, pod_name: "other" }));
  assert.ok(!matchesLogLineRef(ref!, { ...line, timestamp: "2026-08-31T10:00:00.123456788Z" }));
});

test("parseLogLineRef is null for malformed values", () => {
  assert.equal(parseLogLineRef(undefined), null);
  assert.equal(parseLogLineRef(""), null);
  assert.equal(parseLogLineRef("no-separator"), null);
  assert.equal(parseLogLineRef("~pod-only"), null);
  assert.equal(parseLogLineRef("2026-08-31T10:00:00Z~"), null);
  assert.equal(parseLogLineRef("not-a-time~pod"), null);
});

test("nearestLogLineIndex picks the closest usable timestamp", () => {
  const lines = [
    { timestamp: "2026-08-31T10:00:00Z" },
    { timestamp: undefined },
    { timestamp: "2026-08-31T10:00:10Z" },
    { timestamp: "2026-08-31T10:00:30Z" },
  ];
  assert.equal(nearestLogLineIndex(lines, Date.parse("2026-08-31T10:00:12Z")), 2);
  assert.equal(nearestLogLineIndex(lines, Date.parse("2026-08-31T09:00:00Z")), 0);
  assert.equal(nearestLogLineIndex(lines, Date.parse("2026-08-31T11:00:00Z")), 3);
  assert.equal(nearestLogLineIndex([{ timestamp: undefined }], Date.now()), -1);
  assert.equal(nearestLogLineIndex([], Date.now()), -1);
});
