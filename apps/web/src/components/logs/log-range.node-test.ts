import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  activeLogRangePreset,
  decodeRange,
  decodeRangeToken,
  defaultLogRange,
  encodeRange,
  encodeRangeToken,
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

describe("resolveLogRange within bounds", () => {
  const boundsStart = from + HOUR;
  const boundsEnd = until - HOUR;

  it("anchors a preset to the bounded end and closes the window", () => {
    assert.deepEqual(resolveLogRange({ preset: "1h" }, { start: boundsStart, end: boundsEnd }), {
      start: new Date(boundsEnd - HOUR).toISOString(),
      end: new Date(boundsEnd).toISOString(),
    });
  });

  it("stays live when only the start is bounded", () => {
    const { end } = resolveLogRange({ preset: "1h" }, { start: boundsStart });
    assert.equal(end, null);
  });

  it("clamps a preset that reaches past the bounded start", () => {
    assert.deepEqual(resolveLogRange({ preset: "30d" }, { start: boundsStart, end: boundsEnd }), {
      start: new Date(boundsStart).toISOString(),
      end: new Date(boundsEnd).toISOString(),
    });
  });

  it("clamps explicit from and until to the bounds", () => {
    assert.deepEqual(resolveLogRange({ from, until }, { start: boundsStart, end: boundsEnd }), {
      start: new Date(boundsStart).toISOString(),
      end: new Date(boundsEnd).toISOString(),
    });
  });

  it("keeps a narrower explicit window as is", () => {
    const narrowFrom = boundsStart + HOUR;
    const narrowUntil = boundsEnd - HOUR;
    assert.deepEqual(
      resolveLogRange(
        { from: narrowFrom, until: narrowUntil },
        { start: boundsStart, end: boundsEnd },
      ),
      { start: new Date(narrowFrom).toISOString(), end: new Date(narrowUntil).toISOString() },
    );
  });

  it("closes an explicit from at the bounded end", () => {
    assert.deepEqual(resolveLogRange({ from: boundsStart }, { end: boundsEnd }), {
      start: new Date(boundsStart).toISOString(),
      end: new Date(boundsEnd).toISOString(),
    });
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

  it("encodes a bare preset for a live preset range", () => {
    assert.equal(encodeRange({ preset: "5m" }), "5m");
  });

  it("writes UTC timestamps, dropping the parts that are zero", () => {
    assert.equal(encodeRange({ preset: "5m", until }), "5m..2026-01-02_12:00");
    assert.equal(encodeRange({ from, until }), "2026-01-01_12:00..2026-01-02_12:00");
    assert.equal(encodeRange({ from: Date.UTC(2026, 0, 1) }), "2026-01-01..");
    assert.equal(encodeRange({ from: Date.UTC(2026, 0, 1, 12, 0, 30) }), "2026-01-01_12:00:30..");
  });

  it("rounds sub-second moments outward", () => {
    assert.equal(
      encodeRange({ from: from + 900, until: until + 100 }),
      "2026-01-01_12:00..2026-01-02_12:00:01",
    );
  });

  it("drops the preset from the encoding once from pins the start", () => {
    assert.deepEqual(decodeRange(encodeRange({ preset: "5m", from })), { from, until: undefined });
  });

  it("reads an until with no start as anchored to the default preset", () => {
    const decoded = decodeRange("..2026-01-02_12:00");
    assert.equal(activeLogRangePreset(decoded), "24h");
    assert.deepEqual(resolveLogRange(decoded), resolveLogRange({ until }));
  });

  it("falls back to the default for empty or malformed values", () => {
    assert.deepEqual(decodeRange(undefined), defaultLogRange);
    assert.deepEqual(decodeRange(""), defaultLogRange);
    assert.deepEqual(decodeRange(".."), defaultLogRange);
    assert.deepEqual(decodeRange("nonsense"), defaultLogRange);
    assert.deepEqual(decodeRange("99y..2026-01-02_12:00"), defaultLogRange);
    assert.deepEqual(decodeRange("2026-13-01.."), defaultLogRange);
    assert.deepEqual(decodeRange("2026-01-01_25:00.."), defaultLogRange);
  });

  it("rejects a range that ends before it starts", () => {
    assert.deepEqual(decodeRange("2026-01-02_12:00..2026-01-01_12:00"), defaultLogRange);
    assert.deepEqual(decodeRange("2026-01-01_12:00..2026-01-01_12:00"), defaultLogRange);
  });
});

describe("range token codec", () => {
  const localNoon = new Date(2026, 0, 1, 12, 0).getTime();
  const localLater = new Date(2026, 0, 2, 12, 0).getTime();

  it("writes local time and reads it back", () => {
    assert.equal(encodeRangeToken({ preset: "1h" }), "1h");
    assert.equal(
      encodeRangeToken({ from: localNoon, until: localLater }),
      "2026-01-01_12:00..2026-01-02_12:00",
    );
    assert.deepEqual(decodeRangeToken("2026-01-01_12:00..2026-01-02_12:00"), {
      from: localNoon,
      until: localLater,
    });
    assert.deepEqual(decodeRangeToken("2026-01-01_12:00.."), { from: localNoon, until: undefined });
    assert.deepEqual(decodeRangeToken("1h..2026-01-02_12:00"), { preset: "1h", until: localLater });
  });

  it("accepts a bare date as local midnight", () => {
    assert.deepEqual(decodeRangeToken("2026-01-01.."), {
      from: new Date(2026, 0, 1).getTime(),
      until: undefined,
    });
  });

  it("is null for malformed values so they can stay plain terms", () => {
    assert.equal(decodeRangeToken(""), null);
    assert.equal(decodeRangeToken("nonsense"), null);
    assert.equal(decodeRangeToken(".."), null);
    assert.equal(decodeRangeToken("2026-01-02_12:00..2026-01-01_12:00"), null);
  });

  for (const range of [
    { preset: "15m" },
    { from: localNoon },
    { from: localNoon, until: localLater },
    { preset: "6h", until: localLater },
  ] satisfies TLogRange[]) {
    it(`round trips ${JSON.stringify(range)}`, () => {
      const decoded = decodeRangeToken(encodeRangeToken(range));
      assert.ok(decoded);
      assert.deepEqual(resolveLogRange(decoded), resolveLogRange(range));
      assert.equal(encodeRangeToken(decoded), encodeRangeToken(range));
    });
  }
});
