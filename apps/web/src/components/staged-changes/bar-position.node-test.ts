import assert from "node:assert/strict";
import { test } from "node:test";

import {
  availableBarSlots,
  barBounds,
  barSlotPosition,
  clampToBounds,
  nearestBarSlot,
  project,
  projectPoint,
  resolveBarSlot,
  type TBarLayout,
} from "./bar-position.ts";

const layout: TBarLayout = {
  track: { width: 1000, height: 600 },
  bar: { width: 300, height: 50 },
  insets: { top: 50, bottom: 10 },
};
const allSlots = availableBarSlots({ isExtraSmall: false });
const phoneSlots = availableBarSlots({ isExtraSmall: true });

test("project scales with velocity and keeps its sign", () => {
  assert.equal(project(0), 0);
  assert.ok(Math.abs(project(1000) - 499) < 0.01);
  assert.ok(Math.abs(project(-1000) + 499) < 0.01);
  assert.ok(project(1000, 0.99) < project(1000));
});

test("phones get top and bottom, larger screens get all four corners", () => {
  assert.deepEqual(phoneSlots, ["top-left", "bottom-left"]);
  assert.equal(allSlots.length, 4);
});

test("bounds keep the bar inside the track minus the insets", () => {
  assert.deepEqual(barBounds(layout), { left: 0, top: 50, right: 700, bottom: 540 });
});

test("slot positions sit the bar flush against the insets", () => {
  assert.deepEqual(barSlotPosition("top-left", layout), { x: 0, y: 50 });
  assert.deepEqual(barSlotPosition("top-right", layout), { x: 700, y: 50 });
  assert.deepEqual(barSlotPosition("bottom-left", layout), { x: 0, y: 540 });
  assert.deepEqual(barSlotPosition("bottom-right", layout), { x: 700, y: 540 });
});

test("bounds never invert when the bar outgrows the track", () => {
  const tiny: TBarLayout = { ...layout, track: { width: 200, height: 40 } };
  assert.deepEqual(barBounds(tiny), { left: 0, top: 50, right: 0, bottom: 50 });
});

test("a slow drop lands on the nearest slot to the release point", () => {
  const projected = projectPoint({ x: 100, y: 500 }, { x: 0, y: 0 });
  assert.equal(nearestBarSlot(projected, allSlots, layout), "bottom-left");
});

test("a flick lands where the bar is going, not where it was released", () => {
  const projected = projectPoint({ x: 100, y: 500 }, { x: 1600, y: -1400 });
  assert.equal(nearestBarSlot(projected, allSlots, layout), "top-right");
});

test("a flick toward a slot that is not offered lands on the closest one that is", () => {
  const withoutTopRight = allSlots.filter((slot) => slot !== "top-right");
  const projected = projectPoint({ x: 100, y: 500 }, { x: 1600, y: -1400 });
  assert.equal(nearestBarSlot(projected, withoutTopRight, layout), "bottom-right");
});

test("clampToBounds keeps the projection inside the bounds", () => {
  assert.deepEqual(clampToBounds({ x: -50, y: 2000 }, layout), { x: 0, y: 540 });
  assert.deepEqual(clampToBounds({ x: 300, y: 100 }, layout), { x: 300, y: 100 });
  assert.deepEqual(clampToBounds({ x: 300, y: 0 }, layout), { x: 300, y: 50 });
});

test("clamping keeps a hard vertical flick in its own column", () => {
  const withoutTopRight = allSlots.filter((slot) => slot !== "top-right");
  const projected = projectPoint({ x: 700, y: 540 }, { x: 0, y: -5000 });
  assert.equal(nearestBarSlot(projected, withoutTopRight, layout), "top-left");
  const clamped = clampToBounds(projected, layout);
  assert.equal(nearestBarSlot(clamped, withoutTopRight, layout), "bottom-right");
});

test("resolveBarSlot keeps the preference when it is available", () => {
  assert.equal(resolveBarSlot("top-right", allSlots, layout), "top-right");
});

test("resolveBarSlot falls back to the closest available slot", () => {
  const phone: TBarLayout = {
    track: { width: 360, height: 700 },
    bar: { width: 360, height: 50 },
    insets: { top: 8, bottom: 100 },
  };
  assert.equal(resolveBarSlot("top-right", phoneSlots, phone), "top-left");
  assert.equal(resolveBarSlot("bottom-right", phoneSlots, phone), "bottom-left");
});
