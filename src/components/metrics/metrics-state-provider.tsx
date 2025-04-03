"use client";

import { MetricsIntervalEnum, TMetricsIntervalEnum } from "@/server/trpc/api/metrics/types";
import { parseAsStringEnum, useQueryState, UseQueryStateReturn } from "nuqs";
import { createContext, useContext, useMemo } from "react";

type TInterval = {
  value: TMetricsIntervalEnum;
  label: string;
};

const intervals: TInterval[] = [
  {
    value: "1h",
    label: "Last 1 hour",
  },
  {
    value: "6h",
    label: "Last 6 hours",
  },
  {
    value: "24h",
    label: "Last 24 hours",
  },
  {
    value: "7d",
    label: "Last 7 days",
  },
  {
    value: "30d",
    label: "Last 30 days",
  },
];

export const metricsIntervalEnumDefault: TMetricsIntervalEnum = "24h";
export const metricsIntervalDefault =
  intervals.find((i) => i.value === metricsIntervalEnumDefault) ||
  intervals[Math.min(2, intervals.length - 1)];
export const metricsIntervalSearchParamKey = "metrics_interval";

type TMetricsStateContext = {
  intervals: TInterval[];
  setInterval: UseQueryStateReturn<TMetricsIntervalEnum, TMetricsIntervalEnum>["1"];
  interval: TInterval;
};

const MetricsStateContext = createContext<TMetricsStateContext | null>(null);

type TProps = {
  children: React.ReactNode;
};

export const MetricsStateProvider: React.FC<TProps> = ({ children }) => {
  const [interval, setInterval] = useQueryState(
    metricsIntervalSearchParamKey,
    parseAsStringEnum(MetricsIntervalEnum.options).withDefault(metricsIntervalEnumDefault),
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
