import { RefObject, useCallback, useEffect, useRef } from "react";

// Keeps the active item of a horizontally scrollable container in view. Scrolls
// only as far as needed to make the item fully visible (never to the start), so
// already-visible items don't jitter. The first activation scrolls instantly;
// later ones animate. `endInset` (e.g. the width of an overflow indicator
// overlaying the trailing edge) shrinks the visible region so the item clears it
// too.
export function useScrollActiveIntoView<T extends string>({
  containerRef,
  activeKey,
  endInset = 0,
}: {
  containerRef: RefObject<HTMLElement | null>;
  activeKey: T;
  endInset?: number;
}) {
  const itemRefs = useRef(new Map<T, HTMLElement>());
  const isFirstRef = useRef(true);

  const registerItem = useCallback(
    (key: T) => (el: HTMLElement | null) => {
      if (el) itemRefs.current.set(key, el);
      else itemRefs.current.delete(key);
    },
    [],
  );

  useEffect(() => {
    const container = containerRef.current;
    const el = itemRefs.current.get(activeKey);
    if (!container || !el) return;

    const cRect = container.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    const visibleRight = cRect.right - endInset;

    const behavior: ScrollBehavior = isFirstRef.current ? "auto" : "smooth";
    isFirstRef.current = false;

    if (eRect.left < cRect.left) {
      container.scrollTo({ left: container.scrollLeft - (cRect.left - eRect.left), behavior });
    } else if (eRect.right > visibleRight) {
      container.scrollTo({ left: container.scrollLeft + (eRect.right - visibleRight), behavior });
    }
  }, [containerRef, activeKey, endInset]);

  return { registerItem };
}
