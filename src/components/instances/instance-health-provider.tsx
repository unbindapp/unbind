"use client";

import { AppRouterOutputs, AppRouterQueryResult } from "@/server/trpc/api/root";
import { api } from "@/server/trpc/setup/client";
import { createContext, ReactNode, useContext } from "react";

type TInstanceHealthContext = AppRouterQueryResult<AppRouterOutputs["instances"]["health"]>;

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
  const query = api.instances.health.useQuery(
    { teamId, projectId, environmentId, serviceId },
    { refetchInterval: 3000 },
  );

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
  const utils = api.useUtils();
  return {
    invalidate: () =>
      utils.instances.health.invalidate({ teamId, projectId, environmentId, serviceId }),
    fetch: () => utils.instances.health.fetch({ teamId, projectId, environmentId, serviceId }),
    refetch: () => utils.instances.health.refetch({ teamId, projectId, environmentId, serviceId }),
  };
};
