import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { aggregateDataKey, shapeMetricSeries, type TMetricDetail } from "./shape-metrics.ts";

const details: TMetricDetail[] = [
  { timestamp: "2026-01-01T00:00:00Z", breakdown: { a: 1, b: 2, c: null } },
  { timestamp: "2026-01-01T00:01:00Z", breakdown: { a: null, b: null, c: null } },
  { timestamp: "2026-01-01T00:02:00Z", breakdown: { a: 4, b: null, c: 6 } },
];

describe("shapeMetricSeries individual", () => {
  it("spreads every breakdown key when nothing is selected", () => {
    assert.deepEqual(shapeMetricSeries(details, "individual", []), [
      { timestamp: "2026-01-01T00:00:00Z", a: 1, b: 2, c: null },
      { timestamp: "2026-01-01T00:01:00Z", a: null, b: null, c: null },
      { timestamp: "2026-01-01T00:02:00Z", a: 4, b: null, c: 6 },
    ]);
  });

  it("keeps only the selected keys", () => {
    assert.deepEqual(shapeMetricSeries(details, "individual", ["b", "c"]), [
      { timestamp: "2026-01-01T00:00:00Z", b: 2, c: null },
      { timestamp: "2026-01-01T00:01:00Z", b: null, c: null },
      { timestamp: "2026-01-01T00:02:00Z", b: null, c: 6 },
    ]);
  });

  it("ignores selected ids missing from the breakdown", () => {
    assert.deepEqual(shapeMetricSeries(details.slice(0, 1), "individual", ["a", "gone"]), [
      { timestamp: "2026-01-01T00:00:00Z", a: 1 },
    ]);
  });
});

describe("shapeMetricSeries aggregate", () => {
  it("sums every key when nothing is selected", () => {
    assert.deepEqual(shapeMetricSeries(details, "aggregate", []), [
      { timestamp: "2026-01-01T00:00:00Z", [aggregateDataKey]: 3 },
      { timestamp: "2026-01-01T00:01:00Z", [aggregateDataKey]: null },
      { timestamp: "2026-01-01T00:02:00Z", [aggregateDataKey]: 10 },
    ]);
  });

  it("sums only the selected keys and skips nulls", () => {
    assert.deepEqual(shapeMetricSeries(details, "aggregate", ["a", "c"]), [
      { timestamp: "2026-01-01T00:00:00Z", [aggregateDataKey]: 1 },
      { timestamp: "2026-01-01T00:01:00Z", [aggregateDataKey]: null },
      { timestamp: "2026-01-01T00:02:00Z", [aggregateDataKey]: 10 },
    ]);
  });

  it("is null when the selection matches nothing", () => {
    assert.deepEqual(shapeMetricSeries(details.slice(0, 1), "aggregate", ["gone"]), [
      { timestamp: "2026-01-01T00:00:00Z", [aggregateDataKey]: null },
    ]);
  });

  it("returns no rows for no details", () => {
    assert.deepEqual(shapeMetricSeries([], "aggregate", []), []);
  });
});
