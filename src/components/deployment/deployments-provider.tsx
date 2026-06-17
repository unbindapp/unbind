"use client";

import { queryKeys } from "@/api/query-keys";
import { deploymentsListQuery, type TDeploymentsList } from "@/api/services/deployments";
import { useService } from "@/components/service/service-provider";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { createContext, ReactNode, useContext, useMemo } from "react";

type TDeploymentsContext = {
  query: UseQueryResult<TDeploymentsList, Error>;
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
  const query = useQuery({
    ...deploymentsListQuery(teamId, projectId, environmentId, serviceId),
    refetchInterval: 5000,
    staleTime: 0,
  });

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
  const queryClient = useQueryClient();
  const queryKey = queryKeys.deployments.list(teamId, projectId, environmentId, serviceId);
  return {
    invalidate: () => queryClient.invalidateQueries({ queryKey }),
    fetch: () =>
      queryClient.ensureQueryData(deploymentsListQuery(teamId, projectId, environmentId, serviceId)),
    refetch: () => queryClient.refetchQueries({ queryKey }),
  };
};
