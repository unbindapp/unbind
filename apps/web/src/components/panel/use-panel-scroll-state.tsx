"use client";

import { settleScroll } from "@/lib/helpers/settle-scroll";
import { createContext, ReactNode, useCallback, useContext } from "react";

// Keyed by panel, entity and tab, so a reopened panel comes back where the user
// left it and another entity opens at the top. Lives next to the saved search
// state: memory, not storage, and it survives the panel unmounting on close.
const savedScrollByKey = new Map<string, number>();

// Content usually lands in the first commit from the query cache. When it doesn't,
// skeletons are shorter than the list and the restore keeps re-applying until the
// list is tall enough or the user scrolls, then gives up after about a second.
const RESTORE_SETTLE_FRAMES = 60;

const PanelScrollKeyContext = createContext<string | null>(null);

export function panelScrollKey(...parts: string[]) {
  return parts.join(":");
}

export function PanelScrollKeyProvider({
  scrollKey,
  children,
}: {
  scrollKey: string | null;
  children: ReactNode;
}) {
  return (
    <PanelScrollKeyContext.Provider value={scrollKey}>{children}</PanelScrollKeyContext.Provider>
  );
}

// For scrollers a tab renders itself instead of using PanelTabWrapper's.
export function usePanelScrollKey() {
  return useContext(PanelScrollKeyContext);
}

export function usePanelScrollRestoration(scrollKey: string | null) {
  return useCallback(
    (viewport: HTMLDivElement | null) => {
      if (!viewport || !scrollKey) return;

      // Only scroll events are trusted: by the time the ref cleanup runs the viewport
      // may already be detached and read 0. Scroll events during a restore are the
      // restore's own, or the browser clamping to content that has not loaded yet,
      // so they must not overwrite the position being restored either.
      let isRestoring = false;
      const save = () => {
        if (isRestoring) return;
        savedScrollByKey.set(scrollKey, viewport.scrollTop);
      };
      viewport.addEventListener("scroll", save, { passive: true });

      const target = savedScrollByKey.get(scrollKey) ?? 0;
      isRestoring = target > 0;
      const cancelRestore = settleScroll(
        viewport,
        () => {
          if (!isRestoring) return false;
          viewport.scrollTop = target;
          return viewport.scrollTop < target - 1;
        },
        {
          maxFrames: RESTORE_SETTLE_FRAMES,
          onEnd: () => {
            isRestoring = false;
          },
        },
      );

      return () => {
        viewport.removeEventListener("scroll", save);
        cancelRestore();
      };
    },
    [scrollKey],
  );
}
