"use client";

import { replicasListQuery, TReplicasList } from "@/lib/queries/replicas";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { createContext, ReactNode, useContext } from "react";

type TReplicasContext = UseQueryResult<TReplicasList, Error>;

const ReplicasContext = createContext<TReplicasContext | null>(null);

type TProps = {
  teamId: string;
  projectId: string;
  environmentId: string;
  serviceId: string;
  children: ReactNode;
};

export const ReplicasProvider: React.FC<TProps> = ({
  teamId,
  projectId,
  environmentId,
  serviceId,
  children,
}) => {
  const query = useQuery({
    ...replicasListQuery({ teamId, projectId, environmentId, serviceId }),
    refetchInterval: 5000,
  });

  return <ReplicasContext.Provider value={query}>{children}</ReplicasContext.Provider>;
};

export const useReplicas = () => {
  const context = useContext(ReplicasContext);
  if (!context) {
    throw new Error("useReplicas must be used within a ReplicasProvider");
  }
  return context;
};

export default ReplicasProvider;
