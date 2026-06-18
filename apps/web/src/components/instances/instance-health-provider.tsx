"use client";

import { queryKeys } from "@/lib/queries/query-keys";
import { instanceHealthQuery, type TInstanceHealth } from "@/lib/queries/instances";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { createContext, ReactNode, useContext } from "react";

type TInstanceHealthContext = UseQueryResult<TInstanceHealth, Error>;

const InstanceHealthContext = createContext<TInstanceHealthContext | null>(null);

type TProps = {
  teamId: string;
  projectId: string;
  environmentId: string;
  serviceId: string;
  children: ReactNode;
};

export const InstanceHealthProvider: React.FC<TProps> = ({
  teamId,
  projectId,
  environmentId,
  serviceId,
  children,
}) => {
  const query = useQuery({
    ...instanceHealthQuery(teamId, projectId, environmentId, serviceId),
    refetchInterval: 3000,
  });

  return <InstanceHealthContext.Provider value={query}>{children}</InstanceHealthContext.Provider>;
};

export const useInstanceHealth = () => {
  const context = useContext(InstanceHealthContext);
  if (!context) {
    throw new Error("useInstanceHealth must be used within an InstanceHealthProvider");
  }
  return context;
};

export default InstanceHealthProvider;

export const useInstanceHealthUtils = ({
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
  const queryKey = queryKeys.instances.health(teamId, projectId, environmentId, serviceId);
  return {
    invalidate: () => queryClient.invalidateQueries({ queryKey }),
    fetch: () =>
      queryClient.ensureQueryData(instanceHealthQuery(teamId, projectId, environmentId, serviceId)),
    refetch: () => queryClient.refetchQueries({ queryKey }),
  };
};
