import { useEffect } from "react";

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
