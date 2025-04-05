"use client";

import { AppRouterOutputs, AppRouterQueryResult } from "@/server/trpc/api/root";
import { api } from "@/server/trpc/setup/client";
import { createContext, ReactNode, useContext, useMemo } from "react";

type TDeploymentContext = {
  query: AppRouterQueryResult<AppRouterOutputs["deployments"]["get"]>;
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
  const query = api.deployments.get.useQuery({
    teamId,
    projectId,
    environmentId,
    serviceId,
    deploymentId,
  });

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
  const utils = api.useUtils();
  return {
    invalidate: () =>
      utils.deployments.get.invalidate({
        teamId,
        projectId,
        environmentId,
        serviceId,
        deploymentId,
      }),
    refetch: () =>
      utils.deployments.get.refetch({ teamId, projectId, environmentId, serviceId, deploymentId }),
  };
};
