import { useMemo } from "react";
import { useDebounceCallback, useEventCallback } from "usehooks-ts";

export default function useThrottledCallback<Args extends unknown[]>(
  fn: (...args: Args) => void,
  waitMs: number,
) {
  const stableFn = useEventCallback(fn);
  const options = useMemo(() => ({ leading: true, maxWait: waitMs }), [waitMs]);
  return useDebounceCallback(stableFn, waitMs, options);
}
