"use client";

import { queryKeyServices, servicesListQuery, type TServiceShallow } from "@/lib/queries/services";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { createContext, ReactNode, useContext, useMemo } from "react";

export type TServicesResult = { services: TServiceShallow[] };

type TServicesContext = {
  query: UseQueryResult<TServicesResult, Error>;
  teamId: string;
  projectId: string;
  environmentId: string;
};

const ServicesContext = createContext<TServicesContext | null>(null);

export const ServicesProvider: React.FC<{
  teamId: string;
  projectId: string;
  environmentId: string;
  initialData?: TServicesResult;
  children: ReactNode;
}> = ({ teamId, projectId, environmentId, initialData, children }) => {
  const query = useQuery({
    ...servicesListQuery({ teamId, projectId, environmentId }),
    initialData,
    refetchInterval: 5000,
    // Skip the request during the brief window before the environment is
    // resolved into the URL (the project layout redirects to add it).
    enabled: environmentId !== "",
  });
  const value = useMemo(
    () => ({ query, teamId, projectId, environmentId }),
    [query, teamId, projectId, environmentId],
  );

  return <ServicesContext.Provider value={value}>{children}</ServicesContext.Provider>;
};

export const useServices = () => {
  const context = useContext(ServicesContext);
  if (!context) {
    throw new Error("useServices must be used within an ServicesProvider");
  }
  return context;
};

export default ServicesProvider;

export const useServicesUtils = ({
  teamId,
  projectId,
  environmentId,
}: {
  teamId: string;
  projectId: string;
  environmentId: string;
}) => {
  const queryClient = useQueryClient();
  const queryKey = queryKeyServices.list({ teamId, projectId, environmentId });
  return {
    invalidate: () => queryClient.invalidateQueries({ queryKey }),
    refetch: () => queryClient.refetchQueries({ queryKey }),
  };
};
