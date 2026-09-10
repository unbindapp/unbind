"use client";

import { replicaHealthQuery, type TReplicaHealth } from "@/lib/queries/replicas";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { createContext, ReactNode, useContext } from "react";

type TReplicaHealthContext = UseQueryResult<TReplicaHealth, Error>;

const ReplicaHealthContext = createContext<TReplicaHealthContext | null>(null);

type TProps = {
  teamId: string;
  projectId: string;
  environmentId: string;
  serviceId: string;
  children: ReactNode;
};

export const ReplicaHealthProvider: React.FC<TProps> = ({
  teamId,
  projectId,
  environmentId,
  serviceId,
  children,
}) => {
  const query = useQuery({
    ...replicaHealthQuery({ teamId, projectId, environmentId, serviceId }),
    refetchInterval: 3000,
  });

  return <ReplicaHealthContext.Provider value={query}>{children}</ReplicaHealthContext.Provider>;
};

export const useReplicaHealth = () => {
  const context = useContext(ReplicaHealthContext);
  if (!context) {
    throw new Error("useReplicaHealth must be used within a ReplicaHealthProvider");
  }
  return context;
};

export default ReplicaHealthProvider;
