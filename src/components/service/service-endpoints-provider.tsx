"use client";

import { AppRouterOutputs, AppRouterQueryResult } from "@/server/trpc/api/root";
import { api } from "@/server/trpc/setup/client";
import { createContext, ReactNode, useContext, useMemo } from "react";

type TServiceEndpointsContext = {
  query: AppRouterQueryResult<AppRouterOutputs["services"]["getServiceEndpoints"]>;
  teamId: string;
  projectId: string;
  environmentId: string;
  serviceId: string;
};

const ServiceEndpointsContext = createContext<TServiceEndpointsContext | null>(null);

export const ServiceEndpointsProvider: React.FC<{
  teamId: string;
  projectId: string;
  environmentId: string;
  serviceId: string;
  children: ReactNode;
}> = ({ teamId, projectId, environmentId, serviceId, children }) => {
  const query = api.services.getServiceEndpoints.useQuery(
    { teamId, projectId, environmentId, serviceId },
    { refetchInterval: 5000 },
  );

  const value = useMemo(
    () => ({ query, teamId, projectId, environmentId, serviceId }),
    [query, teamId, projectId, environmentId, serviceId],
  );

  return (
    <ServiceEndpointsContext.Provider value={value}>{children}</ServiceEndpointsContext.Provider>
  );
};

export const useServiceEndpoints = () => {
  const context = useContext(ServiceEndpointsContext);
  if (!context) {
    throw new Error("useServiceEndpoints must be used within an ServiceEndpointsProvider");
  }
  return context;
};

export const useServiceEndpointsUtils = ({
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
      utils.services.getServiceEndpoints.invalidate({
        teamId,
        projectId,
        environmentId,
        serviceId,
      }),
    refetch: () =>
      utils.services.getServiceEndpoints.refetch({ teamId, projectId, environmentId, serviceId }),
    cancel: () =>
      utils.services.getServiceEndpoints.cancel({ teamId, projectId, environmentId, serviceId }),
  };
};

export default ServiceEndpointsProvider;
