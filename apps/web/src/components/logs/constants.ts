import { TLogType } from "@/lib/queries/logs";

export type TLogSearchParamKeys = {
  [K in "q" | "levels" | "services" | "range" | "highlight"]: string;
};

// Log viewers that are the page share the bare log_ keys; viewers that open on
// top of a page (service panel, deployment/build tabs) prefix them with their
// owner so they never clobber the page's filters.
const pageKeys: TLogSearchParamKeys = {
  q: "log_q",
  levels: "log_levels",
  services: "log_services",
  range: "log_range",
  highlight: "log_highlight",
};

function prefixed(owner: string): TLogSearchParamKeys {
  return {
    q: `${owner}_log_q`,
    levels: `${owner}_log_levels`,
    services: `${owner}_log_services`,
    range: `${owner}_log_range`,
    highlight: `${owner}_log_highlight`,
  };
}

export const logSearchParamKeys: Record<TLogType, TLogSearchParamKeys> = {
  team: pageKeys,
  project: pageKeys,
  environment: pageKeys,
  service: prefixed("service"),
  deployment: prefixed("deployment"),
  build: prefixed("build"),
};

// Every key the project route must accept, without duplicates.
export const projectRouteLogSearchParamKeys = [
  ...new Set(Object.values(logSearchParamKeys).flatMap((keys) => Object.values(keys))),
];
