"use client";

import {
  metricsListQuery,
  serverMetricsQuery,
  type TMetrics,
  type TServerMetrics,
} from "@/lib/queries/metrics";
import { useMetricsState } from "@/components/metrics/metrics-state-provider";
import { TLogType } from "@/lib/queries/logs";
import { useQuery } from "@tanstack/react-query";
import { createContext, ReactNode, useContext } from "react";

// Both scopes chart the same four series, servers just come from a different endpoint
type TChartedMetrics = {
  metrics: Pick<
    TMetrics["metrics"] & TServerMetrics["metrics"],
    "cpu" | "ram" | "disk" | "network"
  >;
};

type TMetricsContext = {
  data: TChartedMetrics | undefined;
  isPending: boolean;
  error: Error | null;
};

const MetricsContext = createContext<TMetricsContext | null>(null);

type TBaseProps = {
  children: ReactNode;
  teamId: string;
  type: TLogType;
};

type TProps = TBaseProps &
  (
    | {
        type: "team";
        projectId?: never;
        environmentId?: never;
        serviceId?: never;
      }
    | {
        type: "environment";
        projectId: string;
        environmentId: string;
        serviceId?: never;
      }
    | {
        type: "service";
        projectId: string;
        environmentId: string;
        serviceId: string;
      }
  );

export const MetricsProvider: React.FC<TProps> = ({
  teamId,
  projectId,
  environmentId,
  serviceId,
  type,
  children,
}) => {
  const { interval } = useMetricsState();
  const query = useQuery({
    ...metricsListQuery({
      teamId,
      projectId,
      environmentId,
      serviceId,
      type,
      interval: interval.value,
    }),
    refetchInterval: interval.value === "5m" ? 5000 : interval.value === "15m" ? 15000 : 30000,
  });

  return <MetricsContext.Provider value={query}>{children}</MetricsContext.Provider>;
};

export const ServerMetricsProvider: React.FC<{ children: ReactNode; serverName: string }> = ({
  children,
  serverName,
}) => {
  const { interval } = useMetricsState();
  const query = useQuery({
    ...serverMetricsQuery({ serverName, interval: interval.value }),
    refetchInterval: interval.value === "5m" ? 5000 : interval.value === "15m" ? 15000 : 30000,
  });

  return <MetricsContext.Provider value={query}>{children}</MetricsContext.Provider>;
};

export const useMetrics = () => {
  const context = useContext(MetricsContext);
  if (!context) {
    throw new Error("useMetrics must be used within an MetricsProvider");
  }
  return context;
};

export default MetricsProvider;
