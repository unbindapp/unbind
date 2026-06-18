"use client";

import { deploymentQuery, queryKeyDeployments, type TDeployment } from "@/lib/queries/deployments";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { createContext, ReactNode, useContext, useMemo } from "react";

type TDeploymentContext = {
  query: UseQueryResult<{ deployment: TDeployment }, Error>;
  teamId: string;
  projectId: string;
  environmentId: string;
  serviceId: string;
  deploymentId: string;
};

const DeploymentContext = createContext<TDeploymentContext | null>(null);

export const DeploymentProvider: React.FC<{
  teamId: string;
  projectId: string;
  environmentId: string;
  serviceId: string;
  deploymentId: string;
  children: ReactNode;
}> = ({ teamId, projectId, environmentId, serviceId, deploymentId, children }) => {
  const query = useQuery(
    deploymentQuery({ teamId, projectId, environmentId, serviceId, deploymentId }),
  );

  const value = useMemo(
    () => ({ query, teamId, projectId, environmentId, serviceId, deploymentId }),
    [query, teamId, projectId, environmentId, serviceId, deploymentId],
  );

  return <DeploymentContext.Provider value={value}>{children}</DeploymentContext.Provider>;
};

export const useDeployment = () => {
  const context = useContext(DeploymentContext);
  if (!context) {
    throw new Error("useDeployment must be used within an DeploymentProvider");
  }
  return context;
};

export default DeploymentProvider;

export const useDeploymentUtils = ({
  teamId,
  projectId,
  environmentId,
  serviceId,
  deploymentId,
}: {
  teamId: string;
  projectId: string;
  environmentId: string;
  serviceId: string;
  deploymentId: string;
}) => {
  const queryClient = useQueryClient();
  const queryKey = queryKeyDeployments.detail({
    teamId,
    projectId,
    environmentId,
    serviceId,
    deploymentId,
  });
  return {
    invalidate: () => queryClient.invalidateQueries({ queryKey }),
    refetch: () => queryClient.refetchQueries({ queryKey }),
  };
};
