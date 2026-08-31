// Icon keys for the search field, shared by the completion dropdown and the
// field's inline decorations so an option and the text it inserts always show
// the same icon. The keys index the off-screen cache in
// components/icons/icon-cache.tsx, which the search bar fills.
// Uses relative imports so it can run under `node --test`.

import { findServiceByToken } from "./service-tokens.ts";

/** Namespaced so a service brand can never collide with a level. */
export const levelIconKey = (level: string) => `level:${level}`;

/** Structurally satisfied by TLogSearchData, which owns the loaded values. */
type TIconLookup = {
  levels: readonly string[];
  services: readonly { token: string; brand?: string }[] | undefined;
};

/** Null when the value names nothing this scope has an icon for. */
export function attributeIconKey(key: string, value: string, data: TIconLookup): string | null {
  if (key === "level") {
    const level = value.toLowerCase();
    return data.levels.includes(level) ? levelIconKey(level) : null;
  }
  // undefined while services are still loading, so no icon rather than a wrong one
  if (key !== "service" || !data.services) return null;
  return findServiceByToken(data.services, value)?.brand ?? null;
}
