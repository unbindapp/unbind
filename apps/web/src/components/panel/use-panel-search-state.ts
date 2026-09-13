"use client";

import { drawerAnimationMs } from "@/lib/constants";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef } from "react";

type TSearch = Record<string, unknown>;

// Keyed by the panel's id param so memory survives the provider unmounting, which
// happens to the deployment panel every time the service panel around it closes.
const savedSearchByPanel = new Map<string, Map<string, TSearch>>();

function savedSearchFor(panelKey: string) {
  const existing = savedSearchByPanel.get(panelKey);
  if (existing) return existing;

  const created = new Map<string, TSearch>();
  savedSearchByPanel.set(panelKey, created);
  return created;
}

function pick(search: TSearch, keys: readonly string[]) {
  const picked: TSearch = {};
  for (const key of keys) {
    if (search[key] === undefined) continue;
    picked[key] = search[key];
  }
  return picked;
}

function cleared(keys: readonly string[]) {
  return Object.fromEntries(keys.map((key) => [key, undefined]));
}

type TProps = {
  idKey: string;
  ownedKeys: readonly string[];
  // Ids of panels nested in this one, a subset of ownedKeys. They are cleared as soon
  // as the panel closes instead of after the animation, so a nested drawer doesn't
  // stay on screen after its parent is gone.
  nestedIdKeys?: readonly string[];
};

const noKeys: readonly string[] = [];

// A panel's view state (tab, filters, expanded sections) belongs to the entity it is
// open for. It lives in the URL while the panel is open, moves into memory when it
// closes so a closed panel leaves nothing behind, and comes back when the same entity
// is opened again. Another entity opens on the defaults.
export function usePanelSearchState({ idKey, ownedKeys, nestedIdKeys = noKeys }: TProps) {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as TSearch;
  const currentId = (search[idKey] as string | undefined) ?? null;

  const saved = savedSearchFor(idKey);
  const lastOpen = useRef<{ id: string; values: TSearch } | null>(null);

  const ownedValues = useMemo(() => pick(search, ownedKeys), [search, ownedKeys]);
  const hasOwnedValues = Object.keys(ownedValues).length > 0;

  useEffect(() => {
    if (!currentId) return;
    lastOpen.current = { id: currentId, values: ownedValues };
  }, [currentId, ownedValues]);

  // Reopening within the animation window cancels this, so the panel comes back
  // untouched instead of being reset by a pending cleanup.
  useEffect(() => {
    if (currentId) return;
    if (!lastOpen.current && !hasOwnedValues) return;

    const timeout = setTimeout(() => {
      const closed = lastOpen.current;
      lastOpen.current = null;

      // A panel left on the defaults has nothing to remember, and forgetting it is the
      // point: it is how the user goes back to opening on the defaults.
      if (closed && Object.keys(closed.values).length > 0) saved.set(closed.id, closed.values);
      else if (closed) saved.delete(closed.id);

      if (!hasOwnedValues) return;
      void navigate({
        to: ".",
        search: (prev) => ({ ...prev, ...cleared(ownedKeys) }),
        replace: true,
        resetScroll: false,
      });
    }, drawerAnimationMs);

    return () => clearTimeout(timeout);
  }, [currentId, hasOwnedValues, ownedKeys, saved, navigate]);

  const getOpenSearch = useCallback(
    (id: string): TSearch => ({ ...cleared(ownedKeys), ...saved.get(id), [idKey]: id }),
    [idKey, ownedKeys, saved],
  );

  const openPanel = useCallback(
    (id: string, overrides?: TSearch) => {
      const outgoing = lastOpen.current;
      if (outgoing && outgoing.id !== id) saved.set(outgoing.id, outgoing.values);

      void navigate({
        to: ".",
        search: (prev) => ({ ...prev, ...getOpenSearch(id), ...overrides }),
        replace: true,
        resetScroll: false,
      });
    },
    [navigate, getOpenSearch, saved],
  );

  const closePanel = useCallback(
    () =>
      void navigate({
        to: ".",
        search: (prev) => ({ ...prev, [idKey]: undefined, ...cleared(nestedIdKeys) }),
        replace: true,
        resetScroll: false,
      }),
    [navigate, idKey, nestedIdKeys],
  );

  return { currentId, getOpenSearch, openPanel, closePanel };
}
