import {
  closestCenter,
  defaultDropAnimation,
  getClientRect,
  KeyboardSensor,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useSensor,
  useSensors,
  type Activator,
  type CollisionDetection,
  type DropAnimationFunction,
  type MeasuringConfiguration,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates, type SortingStrategy } from "@dnd-kit/sortable";
import type { SyntheticEvent } from "react";

// Space picks a card up, so Enter keeps opening it
const keyboardCodes = { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] };

// Panels and dialogs a card opens are portaled out of it, but React still bubbles
// their events to the card. Only presses on the card itself pick it up, and not on
// its menu buttons, which open on press.
function onCardItself<A extends Activator<never>>(activators: A[]): A[] {
  return activators.map((activator) => ({
    ...activator,
    handler: (event: SyntheticEvent, ...rest: [never, never]) => {
      const target = event.target as Element;
      if (!(event.currentTarget as Node).contains(target)) return false;
      if (target.closest('[aria-haspopup="menu"]')) return false;
      return activator.handler(event, ...rest);
    },
  }));
}

class CardMouseSensor extends MouseSensor {
  static activators = onCardItself(MouseSensor.activators);
}

class CardTouchSensor extends TouchSensor {
  static activators = onCardItself(TouchSensor.activators);
}

class CardKeyboardSensor extends KeyboardSensor {
  static activators = onCardItself(KeyboardSensor.activators);
}

// Short clicks and taps stay navigation. A card is picked up once it moves, or after
// being held still for a moment. Moving never cancels the hold.
export function useCardSensors() {
  return useSensors(
    useSensor(CardMouseSensor, {
      activationConstraint: { distance: 6, delay: 300, tolerance: Infinity },
    }),
    useSensor(CardTouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(CardKeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates, keyboardCodes }),
  );
}

// An item only lands among the items of its own list, on the one under the
// pointer: cards differ in size, so the dragged card's center can be far from
// it. Outside its list it lands nowhere. Keyboard drags have no pointer.
export const closestInSameList: CollisionDetection = (args) => {
  const list = args.active.data.current?.sortable?.containerId;
  const sameList = {
    ...args,
    droppableContainers: args.droppableContainers.filter(
      (c) => c.data.current?.sortable?.containerId === list,
    ),
  };
  return args.pointerCoordinates ? pointerWithin(sameList) : closestCenter(sameList);
};

// Items don't shift on their own while dragging; the list order changes
// instead and the page lays it out, since cards can differ in size
export const keepInPlace: SortingStrategy = () => null;

const translate = (x: number, y: number) => `translate3d(${x}px, ${y}px, 0)`;

// The picked up card shrinks a little, and grows back as it lands. It grows back
// even when it lands where it was picked up, which dnd-kit's own drop would skip.
const dropCard: DropAnimationFunction = (params) => {
  const { active, dragOverlay, transform } = params;
  const card = dragOverlay.node.firstElementChild;
  const x = transform.x - (dragOverlay.rect.left - active.rect.left);
  const y = transform.y - (dragOverlay.rect.top - active.rect.top);
  const { duration, easing } = defaultDropAnimation;
  const cleanup = defaultDropAnimation.sideEffects?.(params);
  const animations = [
    dragOverlay.node.animate(
      { transform: [translate(transform.x, transform.y), translate(x, y)] },
      { duration, easing, fill: "forwards" },
    ),
    card?.animate(
      { transform: [getComputedStyle(card).transform, "none"] },
      { duration, easing, fill: "forwards" },
    ),
  ];
  return Promise.allSettled(animations.map((a) => a?.finished)).then(() => cleanup?.());
};

export const cardOverlayProps = { className: "*:animate-card-grab", dropAnimation: dropCard };

// dnd-kit measures the overlay's card, so it has to see past the shrink to place the drop
export const cardMeasuring: MeasuringConfiguration = {
  dragOverlay: { measure: (node) => getClientRect(node, { ignoreTransform: true }) },
};

// The click that ends a mouse drag would otherwise open the card
function preventClick(e: MouseEvent) {
  e.preventDefault();
  e.stopPropagation();
}

export function blockClickAfterDrag() {
  window.addEventListener("click", preventClick, { capture: true });
}

export function releaseClickAfterDrag() {
  setTimeout(() => window.removeEventListener("click", preventClick, { capture: true }));
}
