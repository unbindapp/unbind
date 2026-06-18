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
