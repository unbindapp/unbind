import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildLogRows, leadingRowKey, type TLogRow } from "./log-rows.ts";

const line = (key: string) => ({
  key,
  level: "info" as const,
  message: key,
  metadata: {},
  pod_name: "pod",
});

const keysOf = (rows: TLogRow[]) => rows.map((r) => r.key);

describe("buildLogRows", () => {
  it("opens with the leading row even when there are no logs", () => {
    assert.deepEqual(keysOf(buildLogRows([])), [leadingRowKey]);
  });

  it("keeps one row per log line after the leading row", () => {
    const rows = buildLogRows([line("a"), line("b")]);
    assert.equal(rows.length, 3);
    assert.deepEqual(keysOf(rows), [leadingRowKey, "a", "b"]);
  });

  it("puts the log at the index the virtualizer will ask for", () => {
    const rows = buildLogRows([line("a"), line("b")]);
    const second = rows[2];
    assert.equal(second?.kind, "log");
    assert.equal(second?.kind === "log" && second.line.message, "b");
  });

  it("keeps existing keys stable when lines are appended", () => {
    const before = keysOf(buildLogRows([line("a"), line("b")]));
    const after = keysOf(buildLogRows([line("a"), line("b"), line("c")]));
    assert.deepEqual(after.slice(0, before.length), before);
  });

  it("keeps trailing keys stable when older lines are prepended", () => {
    const before = buildLogRows([line("b"), line("c")]);
    const after = buildLogRows([line("a"), line("b"), line("c")]);
    assert.deepEqual(keysOf(after).slice(-2), keysOf(before).slice(-2));
  });
});
