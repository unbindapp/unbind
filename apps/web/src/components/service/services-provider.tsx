"use client";

import { queryKeyServices, servicesListQuery } from "@/lib/queries/services";
import { ServicesContext, type TServicesResult } from "@/components/service/services-context";
import { useDiscardChangesForMissing } from "@/components/staged-changes/staged-changes-provider";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ReactNode, useContext, useMemo } from "react";

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
  // A cached list can be older than the changes, so only a list fetched now can drop them
  const serviceIds = useMemo(
    () => (query.isFetchedAfterMount ? query.data?.services.map((item) => item.id) : undefined),
    [query.data, query.isFetchedAfterMount],
  );
  useDiscardChangesForMissing(environmentId, { serviceIds });
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
