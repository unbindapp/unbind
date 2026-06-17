"use client";

import { queryKeys } from "@/api/query-keys";
import { serviceEndpointsQuery, type TServiceEndpoints } from "@/api/services/services";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { createContext, ReactNode, useContext, useMemo } from "react";

type TServiceEndpointsResult = { endpoints: TServiceEndpoints };

type TServiceEndpointsContext = {
  query: UseQueryResult<TServiceEndpointsResult, Error>;
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
  const query = useQuery({
    ...serviceEndpointsQuery(teamId, projectId, environmentId, serviceId),
    refetchInterval: 5000,
  });

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
  const queryClient = useQueryClient();
  const queryKey = queryKeys.services.endpoints(teamId, projectId, environmentId, serviceId);
  return {
    invalidate: () => queryClient.invalidateQueries({ queryKey }),
    refetch: () => queryClient.refetchQueries({ queryKey }),
    cancel: () => queryClient.cancelQueries({ queryKey }),
  };
};

export default ServiceEndpointsProvider;
