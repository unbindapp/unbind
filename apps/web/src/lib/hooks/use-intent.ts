import { useCallback, useEffect, useRef } from "react";

export const DEFAULT_INTENT_DELAY_MS = 25;

export type TIntentHandlers = {
  onMouseEnter: () => void;
  onFocus: () => void;
  onTouchStart: () => void;
  onMouseLeave: () => void;
  onBlur: () => void;
};

/**
 * Reproduces TanStack Router's intent-based preload timing, decoupled from the router.
 * Pass a callback to run when the user signals intent toward an element (hover/focus/touch);
 * get back event handler props to spread onto any element (`Button`, `div`, `a`, ...).
 *
 * This is NOT a router preload — it just runs `onIntent`, typically
 * `queryClient.prefetchQuery(...)`. De-duping the actual work is the caller's job: a query's
 * `staleTime` already no-ops repeated prefetches.
 */
export function useIntent(params: {
  onIntent: () => void;
  /** Delay before firing on hover/focus. Touch fires immediately. Defaults to 25ms. */
  delay?: number;
  /** When false, returns no-op handlers (e.g. nothing to prefetch yet). Defaults to true. */
  enabled?: boolean;
}): TIntentHandlers {
  const { delay = DEFAULT_INTENT_DELAY_MS, enabled = true } = params;

  // Keep the latest onIntent without forcing handler identity to change.
  const onIntentRef = useRef(params.onIntent);
  onIntentRef.current = params.onIntent;

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const clear = useCallback(() => {
    if (timeoutRef.current != null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const fire = useCallback(() => {
    if (enabledRef.current) onIntentRef.current();
  }, []);

  const schedule = useCallback(() => {
    if (!enabledRef.current || timeoutRef.current != null) return;
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      fire();
    }, delay);
  }, [delay, fire]);

  const fireNow = useCallback(() => {
    clear(); // touch supersedes any pending hover timer
    fire();
  }, [clear, fire]);

  // Cancel any pending timer on unmount.
  useEffect(() => clear, [clear]);

  return {
    onMouseEnter: schedule,
    onFocus: schedule,
    onTouchStart: fireNow,
    onMouseLeave: clear,
    onBlur: clear,
  };
}
