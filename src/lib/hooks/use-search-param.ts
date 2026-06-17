import { useNavigate, useSearch } from "@tanstack/react-router";
import { useCallback } from "react";

/**
 * Lightweight URL-search-param state on top of TanStack Router (replaces nuqs's
 * `useQueryState`). Reads the current match's search (non-strict) and writes via
 * a search updater that preserves the other params. Returns `[value, setValue]`.
 *
 * With a `defaultValue`, the value is non-null (mirrors nuqs `.withDefault(...)`).
 */
export function useSearchParam(
  key: string,
): readonly [string | null, (value: string | null) => void];
export function useSearchParam<T extends string>(
  key: string,
  defaultValue: T,
): readonly [T, (value: T | null) => void];
export function useSearchParam<T extends string>(key: string, defaultValue?: T) {
  const value = useSearch({
    strict: false,
    select: (s) => {
      const raw = (s as Record<string, unknown>)[key];
      return typeof raw === "string" ? (raw as T) : null;
    },
  });

  const navigate = useNavigate();
  const setValue = useCallback(
    (next: string | null) =>
      navigate({
        to: ".",
        search: (prev) => ({ ...(prev as Record<string, unknown>), [key]: next ?? undefined }),
        replace: true,
      }),
    [navigate, key],
  );

  return [value ?? defaultValue ?? null, setValue] as const;
}
