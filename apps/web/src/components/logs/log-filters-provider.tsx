"use client";

import {
  decodeRange,
  defaultLogRange,
  encodeRange,
  type TLogRange,
} from "@/components/logs/log-range";
import { TLogLevel, TLogType } from "@/lib/queries/logs";
import { LogLevelSchema } from "@/lib/server/client.gen";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { createContext, ReactNode, useCallback, useContext, useMemo } from "react";

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
const paramKeys: Record<TLogType, { [K in "q" | "levels" | "services" | "range"]: string }> = {
  team: { q: "tq", levels: "tlevels", services: "tservices", range: "trange" },
  project: { q: "q", levels: "levels", services: "services", range: "range" },
  environment: { q: "q", levels: "levels", services: "services", range: "range" },
  service: { q: "sq", levels: "slevels", services: "sservices", range: "srange" },
  deployment: { q: "dq", levels: "dlevels", services: "dservices", range: "drange" },
  build: { q: "bq", levels: "blevels", services: "bservices", range: "brange" },
};

type TLogFiltersContext = {
  search: string;
  setSearch: (value: string | null) => void;
  levels: TLogLevel[];
  setLevels: (levels: TLogLevel[]) => void;
  serviceIds: string[];
  setServiceIds: (ids: string[]) => void;
  range: TLogRange;
  setRange: (range: TLogRange | null) => void;
  /** Clears every filter and zooms the range around a moment in time. */
  viewInContext: (aroundMs: number) => void;
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
  const navigate = useNavigate();

  const rawParams = routeApi.useSearch({
    select: (s: Record<string, string | undefined>) => ({
      q: s[keys.q],
      levels: s[keys.levels],
      services: s[keys.services],
      range: s[keys.range],
    }),
    structuralSharing: true,
  });

  const setParam = useCallback(
    (key: string, value: string | undefined) =>
      navigate({
        to: ".",
        search: (prev) => ({ ...prev, [key]: value }),
        replace: true,
      }),
    [navigate],
  );

  const setSearch = useCallback(
    (value: string | null) => setParam(keys.q, value || undefined),
    [setParam, keys.q],
  );
  const setLevels = useCallback(
    (levels: TLogLevel[]) => setParam(keys.levels, levels.length ? levels.join(",") : undefined),
    [setParam, keys.levels],
  );
  const setServiceIds = useCallback(
    (ids: string[]) => setParam(keys.services, ids.length ? ids.join(",") : undefined),
    [setParam, keys.services],
  );
  const setRange = useCallback(
    (range: TLogRange | null) =>
      setParam(keys.range, range === null ? undefined : encodeRange(range)),
    [setParam, keys.range],
  );

  const resetFilters = useCallback(
    () =>
      navigate({
        to: ".",
        search: (prev) => ({
          ...prev,
          [keys.q]: undefined,
          [keys.levels]: undefined,
          [keys.services]: undefined,
          [keys.range]: undefined,
        }),
        replace: true,
      }),
    [navigate, keys],
  );

  const viewInContext = useCallback(
    (aroundMs: number) => {
      const contextWindowMs = 15 * 60 * 1000;
      navigate({
        to: ".",
        search: (prev) => ({
          ...prev,
          [keys.q]: undefined,
          [keys.levels]: undefined,
          [keys.services]: undefined,
          [keys.range]: encodeRange({
            from: aroundMs - contextWindowMs,
            until: aroundMs + contextWindowMs,
          }),
        }),
        replace: true,
      });
    },
    [navigate, keys],
  );

  const value: TLogFiltersContext = useMemo(() => {
    const levels = decodeLevels(rawParams.levels);
    const serviceIds = servicesEnabled ? decodeList(rawParams.services) : [];
    const range = rangeEnabled ? decodeRange(rawParams.range) : defaultLogRange;
    const rangeIsSet = rangeEnabled && rawParams.range !== undefined;
    return {
      search: rawParams.q ?? "",
      setSearch,
      levels,
      setLevels,
      serviceIds,
      setServiceIds,
      range,
      setRange,
      viewInContext,
      resetFilters,
      hasActiveFilters:
        Boolean(rawParams.q) || levels.length > 0 || serviceIds.length > 0 || rangeIsSet,
      rangeIsSet,
      rangeEnabled,
      servicesEnabled,
    };
  }, [
    rawParams,
    setSearch,
    setLevels,
    setServiceIds,
    setRange,
    viewInContext,
    resetFilters,
    rangeEnabled,
    servicesEnabled,
  ]);

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
