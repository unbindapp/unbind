"use client";

import { metricsListQuery, type TMetrics } from "@/api/services/metrics";
import { useMetricsState } from "@/components/metrics/metrics-state-provider";
import { TLogType } from "@/server/trpc/api/logs/types";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { createContext, ReactNode, useContext } from "react";

type TMetricsContext = UseQueryResult<TMetrics, Error>;

const MetricsContext = createContext<TMetricsContext | null>(null);

type TBaseProps = {
  children: ReactNode;
  teamId: string;
  projectId: string;
  environmentId: string;
  type: TLogType;
};

type TProps = TBaseProps &
  (
    | {
        type: "environment";
        serviceId?: never;
      }
    | {
        type: "service";
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

export const useMetrics = () => {
  const context = useContext(MetricsContext);
  if (!context) {
    throw new Error("useMetrics must be used within an MetricsProvider");
  }
  return context;
};

export default MetricsProvider;
