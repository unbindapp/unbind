import {
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates, type SortingStrategy } from "@dnd-kit/sortable";

// Space picks a card up, so Enter keeps opening it
const keyboardCodes = { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] };

// Short clicks and taps stay navigation, only a real drag reorders
export function useCardSensors() {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates, keyboardCodes }),
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
