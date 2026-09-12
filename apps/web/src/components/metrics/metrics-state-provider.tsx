"use client";

import {
  metricsSearchParamKeys,
  metricsViewDefault,
  type TMetricsScope,
  type TMetricsSearchParamKeys,
} from "@/components/metrics/constants";
import { metricsViews, type TMetricsView } from "@/components/metrics/shape-metrics";
import { MetricsIntervalEnum, TMetricsIntervalEnum } from "@/lib/queries/metrics";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { createContext, useCallback, useContext, useMemo } from "react";

type TInterval = {
  value: TMetricsIntervalEnum;
  label: string;
};

const intervals: TInterval[] = MetricsIntervalEnum.options.map((value) => ({
  value,
  label: value,
}));

export const metricsIntervalEnumDefault: TMetricsIntervalEnum = "1h";
export const metricsIntervalDefault =
  intervals.find((i) => i.value === metricsIntervalEnumDefault) ||
  intervals[Math.min(2, intervals.length - 1)];

/** The default interval for a freshly created service, narrowing as it ages. */
export function getAgeBasedDefaultIntervalEnum(
  createdAt: string,
): TMetricsIntervalEnum | undefined {
  const created = new Date(createdAt).getTime();
  const elapsed = Date.now() - created;
  if (elapsed <= 5 * 60 * 1000) return "5m";
  if (elapsed <= 15 * 60 * 1000) return "15m";
  return undefined;
}

/**
 * Resolves the interval the metrics tab will fetch with, mirroring
 * {@link MetricsStateProvider}: search param wins, then the age-based default,
 * then the global default — validated against the known intervals.
 */
export function resolveMetricsIntervalEnum(params: {
  searchParamValue: string | null;
  ageBasedDefault: TMetricsIntervalEnum | undefined;
}): TMetricsIntervalEnum {
  const candidate = params.searchParamValue ?? params.ageBasedDefault ?? metricsIntervalEnumDefault;
  return intervals.find((i) => i.value === candidate)?.value ?? metricsIntervalEnumDefault;
}

function decodeView(value: string | undefined): TMetricsView {
  if (!value) return metricsViewDefault;
  return (metricsViews as readonly string[]).includes(value)
    ? (value as TMetricsView)
    : metricsViewDefault;
}

function decodeList(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(",").filter(Boolean);
}

type TMetricsStateContext = {
  scope: TMetricsScope;
  intervals: TInterval[];
  interval: TInterval;
  setInterval: (value: TMetricsIntervalEnum | null) => void;
  view: TMetricsView;
  setView: (view: TMetricsView) => void;
  /** Empty means everything; only meaningful when `selectionEnabled`. */
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  selectionEnabled: boolean;
  viewEnabled: boolean;
  resetFilters: () => void;
  hasActiveFilters: boolean;
};

const MetricsStateContext = createContext<TMetricsStateContext | null>(null);

type TProps = {
  children: React.ReactNode;
  type: TMetricsScope;
  defaultIntervalEnum?: TMetricsIntervalEnum;
};

export const MetricsStateProvider: React.FC<TProps> = ({ children, type, defaultIntervalEnum }) => {
  const keys: TMetricsSearchParamKeys = metricsSearchParamKeys[type];
  const navigate = useNavigate();

  const rawParams = useSearch({
    strict: false,
    select: (s) => {
      const search = s as Record<string, string | undefined>;
      return {
        interval: search[keys.interval],
        view: keys.view ? search[keys.view] : undefined,
        selection: keys.selection ? search[keys.selection] : undefined,
      };
    },
    structuralSharing: true,
  });

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

  const resolvedDefaultIntervalEnum = defaultIntervalEnum ?? metricsIntervalEnumDefault;
  const intervalEnum = rawParams.interval ?? resolvedDefaultIntervalEnum;
  const interval = intervals.find((i) => i.value === intervalEnum) || metricsIntervalDefault;
  const view = decodeView(rawParams.view);
  const selectedIds = useMemo(() => decodeList(rawParams.selection), [rawParams.selection]);
  const selectionEnabled = keys.selection !== undefined;
  const viewEnabled = keys.view !== undefined;

  const setInterval = useCallback(
    (value: TMetricsIntervalEnum | null) => setParams({ [keys.interval]: value ?? undefined }),
    [setParams, keys],
  );

  const setView = useCallback(
    (next: TMetricsView) => {
      if (!keys.view) return;
      setParams({ [keys.view]: next === metricsViewDefault ? undefined : next });
    },
    [setParams, keys],
  );

  const setSelectedIds = useCallback(
    (ids: string[]) => {
      if (!keys.selection) return;
      setParams({ [keys.selection]: ids.length ? ids.join(",") : undefined });
    },
    [setParams, keys],
  );

  const resetFilters = useCallback(() => {
    const patch: Record<string, string | undefined> = { [keys.interval]: undefined };
    if (keys.view) patch[keys.view] = undefined;
    if (keys.selection) patch[keys.selection] = undefined;
    setParams(patch);
  }, [setParams, keys]);

  const hasActiveFilters =
    interval.value !== resolvedDefaultIntervalEnum ||
    view !== metricsViewDefault ||
    selectedIds.length > 0;

  const value: TMetricsStateContext = useMemo(
    () => ({
      scope: type,
      intervals,
      interval,
      setInterval,
      view,
      setView,
      selectedIds,
      setSelectedIds,
      selectionEnabled,
      viewEnabled,
      resetFilters,
      hasActiveFilters,
    }),
    [
      type,
      interval,
      setInterval,
      view,
      setView,
      selectedIds,
      setSelectedIds,
      selectionEnabled,
      viewEnabled,
      resetFilters,
      hasActiveFilters,
    ],
  );

  return <MetricsStateContext.Provider value={value}>{children}</MetricsStateContext.Provider>;
};

export const useMetricsState = () => {
  const context = useContext(MetricsStateContext);
  if (!context) {
    throw new Error("useMetricsState must be used within an MetricsStateProvider");
  }
  return context;
};

export default MetricsStateProvider;
