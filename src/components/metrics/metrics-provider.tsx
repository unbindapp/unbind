"use client";

import { useMetricsState } from "@/components/metrics/metrics-state-provider";
import { TLogType } from "@/server/trpc/api/logs/types";
import { AppRouterOutputs, AppRouterQueryResult } from "@/server/trpc/api/root";
import { api } from "@/server/trpc/setup/client";
import { createContext, ReactNode, useContext } from "react";

type TMetricsContext = AppRouterQueryResult<AppRouterOutputs["metrics"]["list"]> & {};

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
  const query = api.metrics.list.useQuery({
    teamId,
    projectId,
    environmentId,
    serviceId,
    type,
    interval: interval.value,
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
