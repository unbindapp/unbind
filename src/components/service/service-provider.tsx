"use client";

import { AppRouterOutputs, AppRouterQueryResult } from "@/server/trpc/api/root";
import { api } from "@/server/trpc/setup/client";
import { createContext, ReactNode, useContext, useMemo } from "react";

type TServiceContext = {
  query: AppRouterQueryResult<AppRouterOutputs["services"]["get"]>;
  teamId: string;
  projectId: string;
  environmentId: string;
  serviceId: string;
};

const ServiceContext = createContext<TServiceContext | null>(null);

export const ServiceProvider: React.FC<{
  teamId: string;
  projectId: string;
  environmentId: string;
  serviceId: string;
  children: ReactNode;
}> = ({ teamId, projectId, environmentId, serviceId, children }) => {
  const query = api.services.get.useQuery(
    { teamId, projectId, environmentId, serviceId },
    { refetchInterval: 5000 },
  );

  const value = useMemo(
    () => ({ query, teamId, projectId, environmentId, serviceId }),
    [query, teamId, projectId, environmentId, serviceId],
  );

  return <ServiceContext.Provider value={value}>{children}</ServiceContext.Provider>;
};

export const useService = () => {
  const context = useContext(ServiceContext);
  if (!context) {
    throw new Error("useService must be used within an ServiceProvider");
  }
  return context;
};

export default ServiceProvider;

export const useServiceUtils = ({
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
      utils.services.get.invalidate({ teamId, projectId, environmentId, serviceId }),
    refetch: () => utils.services.get.refetch({ teamId, projectId, environmentId, serviceId }),
  };
};
