"use client";

import { queryKeyServices, serviceQuery, type TService } from "@/lib/queries/services";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { createContext, ReactNode, useContext, useMemo } from "react";

export type TServiceResult = { service: TService };

type TServiceContext = {
  query: UseQueryResult<TServiceResult, Error>;
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
  const query = useQuery({
    ...serviceQuery({ teamId, projectId, environmentId, serviceId }),
    staleTime: 5 * 1000,
  });

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
  const queryClient = useQueryClient();
  const queryKey = queryKeyServices.detail({ teamId, projectId, environmentId, serviceId });
  return {
    invalidate: () => queryClient.invalidateQueries({ queryKey }),
    refetch: () => queryClient.refetchQueries({ queryKey }),
    cancel: () => queryClient.cancelQueries({ queryKey }),
  };
};
