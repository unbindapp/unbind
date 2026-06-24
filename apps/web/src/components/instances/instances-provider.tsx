"use client";

import { instancesListQuery, queryKeyInstances, TInstancesList } from "@/lib/queries/instances";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { createContext, ReactNode, useContext } from "react";

type TInstancesContext = UseQueryResult<TInstancesList, Error>;

const InstancesContext = createContext<TInstancesContext | null>(null);

type TProps = {
  teamId: string;
  projectId: string;
  environmentId: string;
  serviceId: string;
  children: ReactNode;
};

export const InstancesProvider: React.FC<TProps> = ({
  teamId,
  projectId,
  environmentId,
  serviceId,
  children,
}) => {
  const query = useQuery({
    ...instancesListQuery({ teamId, projectId, environmentId, serviceId }),
    refetchInterval: 5000,
  });

  return <InstancesContext.Provider value={query}>{children}</InstancesContext.Provider>;
};

export const useInstances = () => {
  const context = useContext(InstancesContext);
  if (!context) {
    throw new Error("useInstances must be used within an InstancesProvider");
  }
  return context;
};

export default InstancesProvider;

export const useInstancesUtils = ({
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
  const queryKey = queryKeyInstances.health({ teamId, projectId, environmentId, serviceId });
  return {
    invalidate: () => queryClient.invalidateQueries({ queryKey }),
    fetch: () =>
      queryClient.ensureQueryData(
        instancesListQuery({ teamId, projectId, environmentId, serviceId }),
      ),
    refetch: () => queryClient.refetchQueries({ queryKey }),
  };
};
