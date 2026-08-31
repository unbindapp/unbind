"use client";

import { buildSearchText, extractSearchFilters } from "@/components/logs/log-filter-search";
import {
  decodeRange,
  defaultLogRange,
  encodeRange,
  type TLogRange,
} from "@/components/logs/log-range";
import { logSearchScopes } from "@/components/logs/log-search-scope";
import { logLineRef, parseLogLineRef, type TLogLineRef } from "@/components/logs/log-utils";
import { buildServiceTokens } from "@/components/logs/service-tokens";
import { useServices } from "@/components/service/services-provider";
import { TLogLevel, TLogType } from "@/lib/queries/logs";
import { LogLevelSchema } from "@/lib/server/client.gen";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo } from "react";

const routeApi = getRouteApi("/$team_id/project/$project_id");

export const logLevels: TLogLevel[] = LogLevelSchema.options;

// What each log scope supports, mirrored by the API's parseLogFilters allowlist.
export const logTypeCapabilities: Record<
  TLogType,
  { range: boolean; services: boolean; serviceColumn: boolean }
> = {
  team: { range: true, services: true, serviceColumn: true },
  project: { range: true, services: true, serviceColumn: true },
  environment: { range: true, services: true, serviceColumn: true },
  service: { range: true, services: false, serviceColumn: true },
  deployment: { range: false, services: false, serviceColumn: false },
  build: { range: false, services: false, serviceColumn: false },
};

function decodeLevels(value: string | undefined): TLogLevel[] {
  if (!value) return [];
  return value.split(",").filter((l): l is TLogLevel => (logLevels as string[]).includes(l));
}

function decodeList(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(",").filter(Boolean);
}

// Each log scope gets its own URL namespace so the page, service panel, and
// deployment/build tabs never share or clobber each other's filters.
const paramKeys: Record<
  TLogType,
  { [K in "q" | "levels" | "services" | "range" | "highlight"]: string }
> = {
  team: {
    q: "tq",
    levels: "tlevels",
    services: "tservices",
    range: "trange",
    highlight: "thighlight_log",
  },
  project: {
    q: "q",
    levels: "levels",
    services: "services",
    range: "range",
    highlight: "highlight_log",
  },
  environment: {
    q: "q",
    levels: "levels",
    services: "services",
    range: "range",
    highlight: "highlight_log",
  },
  service: {
    q: "sq",
    levels: "slevels",
    services: "sservices",
    range: "srange",
    highlight: "shighlight_log",
  },
  deployment: {
    q: "dq",
    levels: "dlevels",
    services: "dservices",
    range: "drange",
    highlight: "dhighlight_log",
  },
  build: {
    q: "bq",
    levels: "blevels",
    services: "bservices",
    range: "brange",
    highlight: "bhighlight_log",
  },
};

type TLogFiltersContext = {
  /** The free-text part of the search (the `q` param), tokens already extracted. */
  search: string;
  /** Canonical search bar text: the filters as tokens, then the free text. */
  searchText: string;
  /** Parses bar text into the filter params; returns the canonical text it committed. */
  commitSearch: (value: string) => string;
  levels: TLogLevel[];
  setLevels: (levels: TLogLevel[]) => void;
  serviceIds: string[];
  setServiceIds: (ids: string[]) => void;
  range: TLogRange;
  setRange: (range: TLogRange | null) => void;
  /** The line "view in context" targets; a marker for the viewer, not a filter. */
  highlightedLog: TLogLineRef | null;
  /** Clears every filter and zooms the range around the given line, highlighting it. */
  viewInContext: (line: { timestamp: string; pod_name: string }) => void;
  resetFilters: () => void;
  hasActiveFilters: boolean;
  rangeIsSet: boolean;
  rangeEnabled: boolean;
  servicesEnabled: boolean;
};

const LogFiltersContext = createContext<TLogFiltersContext | null>(null);

type TProps = {
  children: ReactNode;
  logType: TLogType;
};

export const LogFiltersProvider: React.FC<TProps> = ({ children, logType }) => {
  const { range: rangeEnabled, services: servicesEnabled } = logTypeCapabilities[logType];
  const keys = paramKeys[logType];
  const { attributeKeys } = logSearchScopes[logType];
  const navigate = useNavigate();

  const {
    query: { data: servicesData },
  } = useServices();
  const serviceTokens = useMemo(
    () => buildServiceTokens(servicesData?.services ?? []),
    [servicesData],
  );
  const servicesLoaded = Boolean(servicesData);

  const rawParams = routeApi.useSearch({
    select: (s: Record<string, string | undefined>) => ({
      q: s[keys.q],
      levels: s[keys.levels],
      services: s[keys.services],
      range: s[keys.range],
      highlight: s[keys.highlight],
    }),
    structuralSharing: true,
  });

  // Filters live in the URL, so every write is a navigation. Without
  // resetScroll the router yanks the log list back to the top each time.
  const setParams = useCallback(
    (patch: Record<string, string | undefined>) =>
      navigate({
        to: ".",
        search: (prev) => ({ ...prev, ...patch }),
        replace: true,
        resetScroll: false,
      }),
    [navigate],
  );

  const search = rawParams.q ?? "";
  const levels = useMemo(() => decodeLevels(rawParams.levels), [rawParams.levels]);
  const serviceIds = useMemo(
    () => (servicesEnabled ? decodeList(rawParams.services) : []),
    [servicesEnabled, rawParams.services],
  );
  const range = useMemo(
    () => (rangeEnabled ? decodeRange(rawParams.range) : defaultLogRange),
    [rangeEnabled, rawParams.range],
  );
  const rangeIsSet = rangeEnabled && rawParams.range !== undefined;
  const highlightedLog = useMemo(() => parseLogLineRef(rawParams.highlight), [rawParams.highlight]);

  const extractOptions = useMemo(
    () => ({ attributeKeys, serviceTokens, servicesLoaded }),
    [attributeKeys, serviceTokens, servicesLoaded],
  );

  const searchText = useMemo(
    () =>
      buildSearchText(
        { levels, serviceIds, range: rangeIsSet ? range : null },
        search,
        serviceTokens,
      ),
    [levels, serviceIds, range, rangeIsSet, search, serviceTokens],
  );

  const commitSearch = useCallback(
    (input: string): string => {
      const extracted = extractSearchFilters(input, extractOptions);
      if (extracted.error) {
        // a typo shouldn't wipe the other filters; park the text and wait
        setParams({ [keys.q]: input || undefined, [keys.highlight]: undefined });
        return buildSearchText(
          { levels, serviceIds, range: rangeIsSet ? range : null },
          input,
          serviceTokens,
        );
      }
      const patch: Record<string, string | undefined> = {
        [keys.q]: extracted.q || undefined,
        [keys.levels]: extracted.levels.length ? extracted.levels.join(",") : undefined,
        [keys.range]: extracted.range ? encodeRange(extracted.range) : undefined,
        [keys.highlight]: undefined,
      };
      // Replacing the services while the list is unknown would wipe filters
      // the bar can't even render yet.
      if (servicesLoaded) {
        patch[keys.services] = extracted.serviceIds.length
          ? extracted.serviceIds.join(",")
          : undefined;
      }
      setParams(patch);
      return buildSearchText(
        {
          levels: extracted.levels,
          serviceIds: servicesLoaded ? extracted.serviceIds : serviceIds,
          range: extracted.range,
        },
        extracted.q,
        serviceTokens,
      );
    },
    [
      extractOptions,
      setParams,
      keys,
      levels,
      serviceIds,
      range,
      rangeIsSet,
      serviceTokens,
      servicesLoaded,
    ],
  );

  // Tokens can be left sitting in `q` — committed before the service list
  // loaded, or a hand-written URL. Fold them into the params once they resolve
  // so the filter menu reflects them too; existing params win on conflict.
  useEffect(() => {
    if (!search) return;
    const extracted = extractSearchFilters(search, extractOptions);
    if (extracted.error || extracted.q === search) return;
    const mergedLevels = [...new Set([...levels, ...extracted.levels])];
    const patch: Record<string, string | undefined> = {
      [keys.q]: extracted.q || undefined,
      [keys.levels]: mergedLevels.length ? mergedLevels.join(",") : undefined,
    };
    if (servicesLoaded) {
      const mergedServiceIds = [...new Set([...serviceIds, ...extracted.serviceIds])];
      patch[keys.services] = mergedServiceIds.length ? mergedServiceIds.join(",") : undefined;
    }
    if (!rangeIsSet && extracted.range) patch[keys.range] = encodeRange(extracted.range);
    setParams(patch);
  }, [search, extractOptions, levels, serviceIds, rangeIsSet, servicesLoaded, keys, setParams]);

  // The highlight marks one line in one result set, so any change to what the
  // list shows retires it alongside the write.
  const setLevels = useCallback(
    (next: TLogLevel[]) =>
      setParams({
        [keys.levels]: next.length ? next.join(",") : undefined,
        [keys.highlight]: undefined,
      }),
    [setParams, keys],
  );
  const setServiceIds = useCallback(
    (ids: string[]) =>
      setParams({
        [keys.services]: ids.length ? ids.join(",") : undefined,
        [keys.highlight]: undefined,
      }),
    [setParams, keys],
  );
  const setRange = useCallback(
    (next: TLogRange | null) =>
      setParams({
        [keys.range]: next === null ? undefined : encodeRange(next),
        [keys.highlight]: undefined,
      }),
    [setParams, keys],
  );

  const resetFilters = useCallback(
    () =>
      setParams({
        [keys.q]: undefined,
        [keys.levels]: undefined,
        [keys.services]: undefined,
        [keys.range]: undefined,
        [keys.highlight]: undefined,
      }),
    [setParams, keys],
  );

  const viewInContext = useCallback(
    (line: { timestamp: string; pod_name: string }) => {
      const aroundMs = new Date(line.timestamp).getTime();
      const contextWindowMs = 15 * 60 * 1000;
      setParams({
        [keys.q]: undefined,
        [keys.levels]: undefined,
        [keys.services]: undefined,
        [keys.range]: encodeRange({
          from: aroundMs - contextWindowMs,
          until: aroundMs + contextWindowMs,
        }),
        [keys.highlight]: logLineRef(line),
      });
    },
    [setParams, keys],
  );

  const value: TLogFiltersContext = useMemo(
    () => ({
      search,
      searchText,
      commitSearch,
      levels,
      setLevels,
      serviceIds,
      setServiceIds,
      range,
      setRange,
      highlightedLog,
      viewInContext,
      resetFilters,
      hasActiveFilters: Boolean(search) || levels.length > 0 || serviceIds.length > 0 || rangeIsSet,
      rangeIsSet,
      rangeEnabled,
      servicesEnabled,
    }),
    [
      search,
      searchText,
      commitSearch,
      levels,
      setLevels,
      serviceIds,
      setServiceIds,
      range,
      setRange,
      highlightedLog,
      viewInContext,
      resetFilters,
      rangeIsSet,
      rangeEnabled,
      servicesEnabled,
    ],
  );

  return <LogFiltersContext.Provider value={value}>{children}</LogFiltersContext.Provider>;
};

export const useLogFilters = () => {
  const context = useContext(LogFiltersContext);
  if (!context) {
    throw new Error("useLogFilters must be used within a LogFiltersProvider");
  }
  return context;
};

export default LogFiltersProvider;
