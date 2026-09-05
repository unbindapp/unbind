// Elements that sit above open drawers and dialogs and must not dismiss them when pressed
const exemptSelector = '[data-slot="toast"], [data-staged-changes-bar]';

let lastPointerDownTarget: EventTarget | null = null;

if (typeof document !== "undefined") {
  document.addEventListener(
    "pointerdown",
    (event) => {
      lastPointerDownTarget = event.target;
    },
    true,
  );
}

// A press that opens a menu puts the menu backdrop under the pointer before the
// button is released, so the resulting click lands on body or html. Checking where
// the press started keeps that from counting as an outside press.
export function pressStartedInExemptElement(event: Event | undefined) {
  return [event?.target, lastPointerDownTarget].some(
    (target) => target instanceof Element && target.closest(exemptSelector) !== null,
  );
}
