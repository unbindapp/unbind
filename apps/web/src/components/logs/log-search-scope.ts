// What a log viewer's search bar understands. A scope already pinned to one
// service has nothing to filter by service, so @service isn't offered,
// highlighted or extracted there: it reads as ordinary text, like any other
// unrecognised @token. The keys mirror logTypeCapabilities in
// log-filters-provider.tsx, which decides the same thing for the filter menu.
// Uses relative imports so it can run under `node --test`.

import type { TLogType } from "../../lib/queries/logs.ts";

/** Keys the client resolves itself; anything else is forwarded to the server. */
export const clientAttributeKeys = ["level", "service"] as const;
export type TClientAttributeKey = (typeof clientAttributeKeys)[number];

export type TLogSearchScope = {
  attributeKeys: readonly TClientAttributeKey[];
  placeholder: string;
};

const acrossServices: TLogSearchScope = {
  attributeKeys: clientAttributeKeys,
  placeholder: "Search logs: @level:error @service:my-app",
};

const singleService: TLogSearchScope = {
  attributeKeys: ["level"],
  placeholder: "Search logs: @level:error timeout",
};

export const logSearchScopes: Record<TLogType, TLogSearchScope> = {
  team: acrossServices,
  project: acrossServices,
  environment: acrossServices,
  service: singleService,
  deployment: singleService,
  build: { attributeKeys: ["level"], placeholder: "Search build logs: @level:error failed" },
};
