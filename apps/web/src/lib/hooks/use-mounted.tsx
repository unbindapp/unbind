import { useEffect, useState } from "react";
import { useDebounceValue } from "usehooks-ts";

export function useMounted() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") setMounted(true);
  }, []);

  return mounted;
}

export function useDebouncedMounted(debounceMs: number) {
  const [debouncedMounted, setDebouncedMounted] = useDebounceValue(false, debounceMs);

  useEffect(() => {
    if (typeof window !== "undefined") setDebouncedMounted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return debouncedMounted;
}
