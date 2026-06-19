"use client";

import { useSearchParam } from "@/lib/hooks/use-search-param";
import { TMetricsIntervalEnum } from "@/lib/queries/metrics";
import { createContext, useContext, useMemo } from "react";

type TInterval = {
  value: TMetricsIntervalEnum;
  label: string;
};

const intervals: TInterval[] = [
  {
    value: "5m",
    label: "5m",
  },
  {
    value: "15m",
    label: "15m",
  },
  {
    value: "1h",
    label: "1h",
  },
  {
    value: "6h",
    label: "6h",
  },
  {
    value: "24h",
    label: "24h",
  },
  {
    value: "7d",
    label: "7d",
  },
  {
    value: "30d",
    label: "30d",
  },
];

export const metricsIntervalEnumDefault: TMetricsIntervalEnum = "24h";
export const metricsIntervalDefault =
  intervals.find((i) => i.value === metricsIntervalEnumDefault) ||
  intervals[Math.min(2, intervals.length - 1)];

export const metricsIntervalSearchParamKey = "metrics_interval";

/** The default interval for a freshly created service, narrowing as it ages. */
export function getAgeBasedDefaultIntervalEnum(
  createdAt: string,
): TMetricsIntervalEnum | undefined {
  const created = new Date(createdAt).getTime();
  const elapsed = Date.now() - created;
  if (elapsed <= 5 * 60 * 1000) return "5m";
  if (elapsed <= 15 * 60 * 1000) return "15m";
  if (elapsed <= 60 * 60 * 1000) return "1h";
  if (elapsed <= 6 * 60 * 60 * 1000) return "6h";
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
  const candidate =
    params.searchParamValue ?? params.ageBasedDefault ?? metricsIntervalEnumDefault;
  return intervals.find((i) => i.value === candidate)?.value ?? metricsIntervalEnumDefault;
}

type TMetricsStateContext = {
  intervals: TInterval[];
  setInterval: (value: TMetricsIntervalEnum | null) => void;
  interval: TInterval;
};

const MetricsStateContext = createContext<TMetricsStateContext | null>(null);

type TProps = {
  children: React.ReactNode;
  defaultIntervalEnum?: TMetricsIntervalEnum;
};

export const MetricsStateProvider: React.FC<TProps> = ({ children, defaultIntervalEnum }) => {
  const [interval, setInterval] = useSearchParam<TMetricsIntervalEnum>(
    metricsIntervalSearchParamKey,
    defaultIntervalEnum || metricsIntervalEnumDefault,
  );

  const currentInterval = intervals.find((i) => i.value === interval) || metricsIntervalDefault;

  const value: TMetricsStateContext = useMemo(
    () => ({
      intervals,
      setInterval,
      interval: currentInterval,
    }),
    [setInterval, currentInterval],
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
