import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  activeLogRangePreset,
  decodeRange,
  defaultLogRange,
  encodeRange,
  isLiveRange,
  resolveLogRange,
  type TLogRange,
} from "./log-range.ts";

const HOUR = 60 * 60 * 1000;
const until = Date.UTC(2026, 0, 2, 12, 0, 0);
const from = Date.UTC(2026, 0, 1, 12, 0, 0);

describe("activeLogRangePreset", () => {
  it("falls back to the default when no preset is set", () => {
    assert.equal(activeLogRangePreset({}), "24h");
  });

  it("keeps the preset when only until is set", () => {
    assert.equal(activeLogRangePreset({ preset: "5m", until }), "5m");
  });

  it("deselects once from pins the start", () => {
    assert.equal(activeLogRangePreset({ preset: "5m", from }), null);
    assert.equal(activeLogRangePreset({ from, until }), null);
  });
});

describe("resolveLogRange", () => {
  it("anchors a preset to now when there is no until", () => {
    const before = Date.now();
    const { start, end } = resolveLogRange({ preset: "1h" });
    const startMs = new Date(start).getTime();
    assert.equal(end, null);
    assert.ok(startMs >= before - HOUR && startMs <= Date.now() - HOUR);
  });

  it("anchors a preset to until when one is set", () => {
    assert.deepEqual(resolveLogRange({ preset: "1h", until }), {
      start: new Date(until - HOUR).toISOString(),
      end: new Date(until).toISOString(),
    });
  });

  it("uses the default preset length for an until with no preset", () => {
    assert.deepEqual(resolveLogRange({ until }), {
      start: new Date(until - 24 * HOUR).toISOString(),
      end: new Date(until).toISOString(),
    });
  });

  it("keeps an explicit from live when there is no until", () => {
    assert.deepEqual(resolveLogRange({ from }), {
      start: new Date(from).toISOString(),
      end: null,
    });
  });

  it("ignores the preset when from is set", () => {
    assert.deepEqual(resolveLogRange({ preset: "5m", from, until }), {
      start: new Date(from).toISOString(),
      end: new Date(until).toISOString(),
    });
  });
});

describe("isLiveRange", () => {
  it("is live until an until is set", () => {
    assert.equal(isLiveRange({ preset: "1h" }), true);
    assert.equal(isLiveRange({ from }), true);
    assert.equal(isLiveRange({ preset: "1h", until }), false);
    assert.equal(isLiveRange({ from, until }), false);
  });
});

describe("range url codec", () => {
  const roundTrips: TLogRange[] = [
    { preset: "5m" },
    { preset: "5m", until },
    { until },
    { from },
    { from, until },
  ];

  for (const range of roundTrips) {
    it(`round trips ${JSON.stringify(range)}`, () => {
      const decoded = decodeRange(encodeRange(range));
      assert.deepEqual(resolveLogRange(decoded), resolveLogRange(range));
      assert.equal(activeLogRangePreset(decoded), activeLogRangePreset(range));
    });
  }

  it("encodes a bare preset without the custom fields", () => {
    assert.equal(encodeRange({ preset: "5m" }), "5m");
    assert.equal(encodeRange({ preset: "5m", until }), `5m::${until}`);
    assert.equal(encodeRange({ from, until }), `:${from}:${until}`);
  });

  it("drops the preset from the encoding once from pins the start", () => {
    assert.deepEqual(decodeRange(encodeRange({ preset: "5m", from })), { from, until: undefined });
  });

  it("still reads links written in the old c:from:to form", () => {
    assert.deepEqual(decodeRange(`c:${from}:${until}`), { from, until });
    assert.deepEqual(decodeRange(`c:${from}:`), { from, until: undefined });
  });

  it("falls back to the default for empty or malformed values", () => {
    assert.deepEqual(decodeRange(undefined), defaultLogRange);
    assert.deepEqual(decodeRange(""), defaultLogRange);
    assert.deepEqual(decodeRange("::"), defaultLogRange);
    assert.deepEqual(decodeRange("nonsense"), defaultLogRange);
    assert.deepEqual(decodeRange("1h:abc:def"), defaultLogRange);
  });

  it("repairs an unknown preset next to a valid until", () => {
    assert.deepEqual(decodeRange(`99y::${until}`), { preset: "24h", until });
  });
});
