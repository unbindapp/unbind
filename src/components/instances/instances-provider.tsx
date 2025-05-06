"use client";

import { AppRouterOutputs, AppRouterQueryResult } from "@/server/trpc/api/root";
import { api } from "@/server/trpc/setup/client";
import { createContext, ReactNode, useContext } from "react";

type TInstancesContext = AppRouterQueryResult<AppRouterOutputs["instances"]["list"]>;

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
  const query = api.instances.list.useQuery(
    { teamId, projectId, environmentId, serviceId },
    { refetchInterval: 3000 },
  );

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
  const utils = api.useUtils();
  return {
    invalidate: () =>
      utils.instances.list.invalidate({ teamId, projectId, environmentId, serviceId }),
    fetch: () => utils.instances.list.fetch({ teamId, projectId, environmentId, serviceId }),
    refetch: () => utils.instances.list.refetch({ teamId, projectId, environmentId, serviceId }),
  };
};
