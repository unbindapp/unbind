import { z } from "zod";

export const BarSlotSchema = z.enum(["top-left", "top-right", "bottom-left", "bottom-right"]);
export type TBarSlot = z.infer<typeof BarSlotSchema>;

export type TPoint = { x: number; y: number };
export type TSize = { width: number; height: number };
export type TBounds = { left: number; top: number; right: number; bottom: number };

// The track spans the viewport height, the insets carve out the navbar and safe areas
export type TBarLayout = {
  track: TSize;
  bar: TSize;
  insets: { top: number; bottom: number };
};

// UIScrollView's normal deceleration rate, the constant behind iOS's flick feel
export const decelerationRate = 0.998;

// Distance traveled while decelerating from the given velocity (px/s) to a stop
export function project(velocity: number, rate = decelerationRate) {
  return ((velocity / 1000) * rate) / (1 - rate);
}

export function projectPoint(position: TPoint, velocity: TPoint): TPoint {
  return { x: position.x + project(velocity.x), y: position.y + project(velocity.y) };
}

// Offsets from the track's top left corner the bar may occupy
export function barBounds({ track, bar, insets }: TBarLayout): TBounds {
  return {
    left: 0,
    top: insets.top,
    right: Math.max(0, track.width - bar.width),
    bottom: Math.max(insets.top, track.height - bar.height - insets.bottom),
  };
}

// The bar stops at the bounds, so a projection past them lands on the edge
export function clampToBounds(point: TPoint, layout: TBarLayout): TPoint {
  const bounds = barBounds(layout);
  return {
    x: Math.min(Math.max(bounds.left, point.x), bounds.right),
    y: Math.min(Math.max(bounds.top, point.y), bounds.bottom),
  };
}

export function availableBarSlots({ isExtraSmall }: { isExtraSmall: boolean }): TBarSlot[] {
  if (isExtraSmall) return ["top-left", "bottom-left"];
  return ["top-left", "top-right", "bottom-left", "bottom-right"];
}

export function barSlotEdge(slot: TBarSlot): "top" | "bottom" {
  return slot === "bottom-left" || slot === "bottom-right" ? "bottom" : "top";
}

export function barSlotPosition(slot: TBarSlot, layout: TBarLayout): TPoint {
  const bounds = barBounds(layout);
  const isRight = slot === "top-right" || slot === "bottom-right";
  return {
    x: isRight ? bounds.right : bounds.left,
    y: barSlotEdge(slot) === "bottom" ? bounds.bottom : bounds.top,
  };
}

export function nearestBarSlot(point: TPoint, slots: TBarSlot[], layout: TBarLayout): TBarSlot {
  if (slots.length === 0) return "top-left";
  let nearest = slots[0];
  let nearestDistance = Infinity;
  for (const slot of slots) {
    const position = barSlotPosition(slot, layout);
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
  layout: TBarLayout,
): TBarSlot {
  if (slots.includes(preferred)) return preferred;
  return nearestBarSlot(barSlotPosition(preferred, layout), slots, layout);
}
