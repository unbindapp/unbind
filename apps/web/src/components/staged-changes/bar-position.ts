import { z } from "zod";

export const BarSlotSchema = z.enum(["top-left", "top-right", "bottom-left", "bottom-right"]);
export type TBarSlot = z.infer<typeof BarSlotSchema>;

export type TPoint = { x: number; y: number };
export type TSize = { width: number; height: number };

// UIScrollView's normal deceleration rate, the constant behind iOS's flick feel
export const decelerationRate = 0.998;

// Distance traveled while decelerating from the given velocity (px/s) to a stop
export function project(velocity: number, rate = decelerationRate) {
  return ((velocity / 1000) * rate) / (1 - rate);
}

export function projectPoint(position: TPoint, velocity: TPoint): TPoint {
  return { x: position.x + project(velocity.x), y: position.y + project(velocity.y) };
}

// The bar stops at the track's edges, so a projection past them lands on the edge
export function clampToTrack(point: TPoint, track: TSize, bar: TSize): TPoint {
  return {
    x: Math.min(Math.max(0, point.x), Math.max(0, track.width - bar.width)),
    y: Math.min(Math.max(0, point.y), Math.max(0, track.height - bar.height)),
  };
}

export function availableBarSlots({
  isExtraSmall,
  isDrawerOpen,
}: {
  isExtraSmall: boolean;
  isDrawerOpen: boolean;
}): TBarSlot[] {
  if (isExtraSmall) return ["top-left", "bottom-left"];
  if (isDrawerOpen) return ["top-left", "bottom-left", "bottom-right"];
  return ["top-left", "top-right", "bottom-left", "bottom-right"];
}

export function barSlotEdge(slot: TBarSlot): "top" | "bottom" {
  return slot === "bottom-left" || slot === "bottom-right" ? "bottom" : "top";
}

// Positions are offsets from the track's top left corner
export function barSlotPosition(slot: TBarSlot, track: TSize, bar: TSize): TPoint {
  const isRight = slot === "top-right" || slot === "bottom-right";
  return {
    x: isRight ? Math.max(0, track.width - bar.width) : 0,
    y: barSlotEdge(slot) === "bottom" ? Math.max(0, track.height - bar.height) : 0,
  };
}

export function nearestBarSlot(
  point: TPoint,
  slots: TBarSlot[],
  track: TSize,
  bar: TSize,
): TBarSlot {
  if (slots.length === 0) return "top-left";
  let nearest = slots[0];
  let nearestDistance = Infinity;
  for (const slot of slots) {
    const position = barSlotPosition(slot, track, bar);
    const distance = (position.x - point.x) ** 2 + (position.y - point.y) ** 2;
    if (distance >= nearestDistance) continue;
    nearest = slot;
    nearestDistance = distance;
  }
  return nearest;
}

// The preferred slot when it is available, otherwise the available one closest to it
export function resolveBarSlot(
  preferred: TBarSlot,
  slots: TBarSlot[],
  track: TSize,
  bar: TSize,
): TBarSlot {
  if (slots.includes(preferred)) return preferred;
  return nearestBarSlot(barSlotPosition(preferred, track, bar), slots, track, bar);
}
