import assert from "node:assert/strict";
import { test } from "node:test";

import {
  availableBarSlots,
  barSlotPosition,
  clampToTrack,
  nearestBarSlot,
  project,
  projectPoint,
  resolveBarSlot,
} from "./bar-position.ts";

const track = { width: 1000, height: 600 };
const bar = { width: 300, height: 50 };
const allSlots = availableBarSlots({ isExtraSmall: false, isDrawerOpen: false });

test("project scales with velocity and keeps its sign", () => {
  assert.equal(project(0), 0);
  assert.ok(Math.abs(project(1000) - 499) < 0.01);
  assert.ok(Math.abs(project(-1000) + 499) < 0.01);
  assert.ok(project(1000, 0.99) < project(1000));
});

test("available slots depend on device size and open drawers", () => {
  assert.deepEqual(availableBarSlots({ isExtraSmall: true, isDrawerOpen: false }), [
    "top-left",
    "bottom-left",
  ]);
  assert.deepEqual(availableBarSlots({ isExtraSmall: true, isDrawerOpen: true }), [
    "top-left",
    "bottom-left",
  ]);
  assert.deepEqual(availableBarSlots({ isExtraSmall: false, isDrawerOpen: true }), [
    "top-left",
    "bottom-left",
    "bottom-right",
  ]);
  assert.equal(allSlots.length, 4);
});

test("slot positions sit the bar flush inside the track", () => {
  assert.deepEqual(barSlotPosition("top-left", track, bar), { x: 0, y: 0 });
  assert.deepEqual(barSlotPosition("top-right", track, bar), { x: 700, y: 0 });
  assert.deepEqual(barSlotPosition("bottom-left", track, bar), { x: 0, y: 550 });
  assert.deepEqual(barSlotPosition("bottom-right", track, bar), { x: 700, y: 550 });
});

test("slot positions never go negative when the bar outgrows the track", () => {
  assert.deepEqual(barSlotPosition("bottom-right", { width: 200, height: 40 }, bar), {
    x: 0,
    y: 0,
  });
});

test("a slow drop lands on the nearest slot to the release point", () => {
  const released = { x: 100, y: 500 };
  const projected = projectPoint(released, { x: 0, y: 0 });
  assert.equal(nearestBarSlot(projected, allSlots, track, bar), "bottom-left");
});

test("a flick lands where the bar is going, not where it was released", () => {
  const released = { x: 100, y: 500 };
  const projected = projectPoint(released, { x: 1600, y: -1400 });
  assert.equal(nearestBarSlot(projected, allSlots, track, bar), "top-right");
});

test("a flick toward a blocked slot lands on the closest available one", () => {
  const withDrawer = availableBarSlots({ isExtraSmall: false, isDrawerOpen: true });
  const projected = projectPoint({ x: 100, y: 500 }, { x: 1600, y: -1400 });
  assert.equal(nearestBarSlot(projected, withDrawer, track, bar), "bottom-right");
});

test("clampToTrack keeps the projection inside the track", () => {
  assert.deepEqual(clampToTrack({ x: -50, y: 2000 }, track, bar), { x: 0, y: 550 });
  assert.deepEqual(clampToTrack({ x: 300, y: 100 }, track, bar), { x: 300, y: 100 });
});

test("a hard flick straight up from bottom right stays right when top right is blocked", () => {
  const withDrawer = availableBarSlots({ isExtraSmall: false, isDrawerOpen: true });
  const projected = projectPoint({ x: 700, y: 550 }, { x: 0, y: -5000 });
  assert.equal(nearestBarSlot(projected, withDrawer, track, bar), "top-left");
  const clamped = clampToTrack(projected, track, bar);
  assert.equal(nearestBarSlot(clamped, withDrawer, track, bar), "bottom-right");
});

test("resolveBarSlot keeps the preference when it is available", () => {
  assert.equal(resolveBarSlot("top-right", allSlots, track, bar), "top-right");
});

test("resolveBarSlot falls back to the closest available slot", () => {
  const withDrawer = availableBarSlots({ isExtraSmall: false, isDrawerOpen: true });
  assert.equal(resolveBarSlot("top-right", withDrawer, track, bar), "bottom-right");

  const phone = availableBarSlots({ isExtraSmall: true, isDrawerOpen: false });
  const phoneTrack = { width: 360, height: 700 };
  const phoneBar = { width: 360, height: 50 };
  assert.equal(resolveBarSlot("top-right", phone, phoneTrack, phoneBar), "top-left");
  assert.equal(resolveBarSlot("bottom-right", phone, phoneTrack, phoneBar), "bottom-left");
});
