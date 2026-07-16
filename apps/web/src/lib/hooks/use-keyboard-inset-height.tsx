import { useEffect } from "react";

/**
 * Publishes the height the on-screen keyboard overlaps the viewport by as
 * `--keyboard-inset-height`, so `--safe-screen-height` can subtract it.
 *
 * `svh` is a static unit and never reacts to the keyboard, and Safari still
 * doesn't support `interactive-widget=resizes-content` (WebKit #259770), so
 * visualViewport is the only cross-browser source for this. The value is 0
 * whenever nothing overlaps, which covers desktop without any device check.
 */
export default function useKeyboardInsetHeight() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const update = () => {
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      document.documentElement.style.setProperty("--keyboard-inset-height", `${inset}px`);
    };

    update();
    viewport.addEventListener("resize", update);
    // The keyboard shifts offsetTop without resizing when focus moves between fields.
    viewport.addEventListener("scroll", update);

    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      document.documentElement.style.removeProperty("--keyboard-inset-height");
    };
  }, []);
}
