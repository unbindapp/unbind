"use client";

import { useService } from "@/components/service/service-provider";
import { AppRouterOutputs, AppRouterQueryResult } from "@/server/trpc/api/root";
import { api } from "@/server/trpc/setup/client";
import { createContext, ReactNode, useContext, useMemo } from "react";

type TDeploymentsContext = {
  query: AppRouterQueryResult<AppRouterOutputs["deployments"]["list"]>;
  teamId: string;
  projectId: string;
  environmentId: string;
  serviceId: string;
};

const DeploymentsContext = createContext<TDeploymentsContext | null>(null);

export const DeploymentsProvider: React.FC<{
  children: ReactNode;
}> = ({ children }) => {
  const { teamId, projectId, environmentId, serviceId } = useService();
  const query = api.deployments.list.useQuery(
    { teamId, projectId, environmentId, serviceId },
    { refetchInterval: 4000 },
  );

  const value = useMemo(
    () => ({ query, teamId, projectId, environmentId, serviceId }),
    [query, teamId, projectId, environmentId, serviceId],
  );

  return <DeploymentsContext.Provider value={value}>{children}</DeploymentsContext.Provider>;
};

export const useDeployments = () => {
  const context = useContext(DeploymentsContext);
  if (!context) {
    throw new Error("useDeployments must be used within an DeploymentsProvider");
  }
  return context;
};

export default DeploymentsProvider;

export const useDeploymentsUtils = ({
  teamId,
  projectId,
  environmentId,
  serviceId,
}: {
  teamId: string;
  projectId: string;
  environmentId: string;
  serviceId: string;
}) => {
  const utils = api.useUtils();
  return {
    invalidate: () =>
      utils.deployments.list.invalidate({ teamId, projectId, environmentId, serviceId }),
    fetch: () => utils.deployments.list.fetch({ teamId, projectId, environmentId, serviceId }),
    refetch: () => utils.deployments.list.refetch({ teamId, projectId, environmentId, serviceId }),
  };
};
