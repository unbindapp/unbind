// Bridges the search text and the structured filter params so the bar and the
// filter menu always describe the same state: committing text extracts the
// tokens the scope resolves into filters, and any external filter change is
// rendered back into text. extractSearchFilters(buildSearchText(state)) gives
// back the same state, which is what keeps the two-way sync from looping.
// Uses relative imports so it can run under `node --test`.

import { LogLevelSchema, type LogLevel } from "../../lib/server/client.gen.ts";
import { encodeRangeToken, type TLogRange } from "./log-range.ts";
import type { TClientAttributeKey } from "./log-search-scope.ts";
import { parseSearchInput } from "./search-syntax.ts";
import { findServiceByToken, type TServiceToken } from "./service-tokens.ts";

export type TSearchFilters = {
  q: string;
  levels: LogLevel[];
  serviceIds: string[];
  range: TLogRange | null;
  /** Set on a malformed input; `q` then carries the input untouched. */
  error: string | null;
};

type TExtractOptions = {
  attributeKeys: readonly TClientAttributeKey[];
  serviceTokens: readonly TServiceToken[];
  /** While false, @service values stay in `q` instead of being guessed at. */
  servicesLoaded: boolean;
};

export function extractSearchFilters(
  input: string,
  { attributeKeys, serviceTokens, servicesLoaded }: TExtractOptions,
): TSearchFilters {
  const knownServiceTokens = new Set(
    servicesLoaded ? serviceTokens.map((t) => t.token.toLowerCase()) : [],
  );
  const parsed = parseSearchInput(input, { attributeKeys, knownServiceTokens });
  if (parsed.error) {
    return { q: input, levels: [], serviceIds: [], range: null, error: parsed.error };
  }

  const serviceIds: string[] = [];
  for (const name of parsed.serviceNames) {
    const service = findServiceByToken(serviceTokens, name);
    if (service && !serviceIds.includes(service.id)) serviceIds.push(service.id);
  }
  return {
    q: parsed.serverSearch,
    levels: parsed.levels,
    serviceIds,
    range: parsed.range,
    error: null,
  };
}

/**
 * Renders filters back into search text: level tokens in their canonical
 * order, then services, then the range, then the free text. A service whose
 * token is unknown (still loading, or deleted) renders nothing. A trailing
 * token keeps a space behind it, just like picking a completion, so typing
 * carries on with a fresh term instead of extending the token.
 */
export function buildSearchText(
  filters: { levels: readonly LogLevel[]; serviceIds: readonly string[]; range: TLogRange | null },
  q: string,
  serviceTokens: readonly TServiceToken[],
): string {
  const parts: string[] = [];
  for (const level of LogLevelSchema.options) {
    if (filters.levels.includes(level)) parts.push(`@level:${level}`);
  }
  for (const id of filters.serviceIds) {
    const service = serviceTokens.find((t) => t.id === id);
    if (service) parts.push(`@service:${service.token}`);
  }
  if (filters.range) parts.push(`@range:${encodeRangeToken(filters.range)}`);
  const tokens = parts.join(" ");
  if (!tokens) return q;
  return q ? `${tokens} ${q}` : `${tokens} `;
}
