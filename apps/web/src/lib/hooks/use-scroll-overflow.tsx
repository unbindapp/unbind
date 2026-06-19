import { RefObject, useCallback, useEffect, useState } from "react";

export function useScrollOverflow({
  ref,
  offset = 0,
}: {
  ref: RefObject<HTMLElement | null>;
  offset?: number;
}) {
  const [canScrollRight, setCanScrollRight] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - offset);
  }, [ref, offset]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    update();

    el.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);

    return () => {
      el.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [ref, update]);

  return { canScrollRight };
}
