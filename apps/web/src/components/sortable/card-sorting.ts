import {
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useSensor,
  useSensors,
  type Activator,
  type CollisionDetection,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates, type SortingStrategy } from "@dnd-kit/sortable";
import type { SyntheticEvent } from "react";

// Space picks a card up, so Enter keeps opening it
const keyboardCodes = { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] };

// Panels and dialogs a card opens are portaled out of it, but React still bubbles
// their events to the card. Only presses on the card itself pick it up.
function onCardItself<A extends Activator<never>>(activators: A[]): A[] {
  return activators.map((activator) => ({
    ...activator,
    handler: (event: SyntheticEvent, ...rest: [never, never]) => {
      if (!(event.currentTarget as Node).contains(event.target as Node)) return false;
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

// Short clicks and taps stay navigation, only a real drag reorders
export function useCardSensors() {
  return useSensors(
    useSensor(CardMouseSensor, { activationConstraint: { distance: 6 } }),
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
