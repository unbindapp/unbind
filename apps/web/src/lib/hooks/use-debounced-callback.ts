import { useDebounceCallback, useEventCallback } from "usehooks-ts";

// usehooks-ts rebuilds the timer when the callback identity changes, orphaning
// pending calls, so the callback is pinned to a stable identity first.
export default function useDebouncedCallback<Args extends unknown[]>(
  fn: (...args: Args) => void,
  delayMs: number,
) {
  const stableFn = useEventCallback(fn);
  return useDebounceCallback(stableFn, delayMs);
}
