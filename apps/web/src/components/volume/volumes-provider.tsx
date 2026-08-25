"use client";

import { TVolumeShallow } from "@/lib/queries/services";
import { queryKeyStorage, volumesListQuery } from "@/lib/queries/storage";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { createContext, ReactNode, useContext, useMemo } from "react";

export type TVolumesResult = { volumes: TVolumeShallow[] };

type TVolumesContext = {
  query: UseQueryResult<TVolumesResult, Error>;
  teamId: string;
  projectId: string;
  environmentId: string;
};

const VolumesContext = createContext<TVolumesContext | null>(null);

export const VolumesProvider: React.FC<{
  teamId: string;
  projectId: string;
  environmentId: string;
  initialData?: TVolumesResult;
  children: ReactNode;
}> = ({ teamId, projectId, environmentId, initialData, children }) => {
  const query = useQuery({
    ...volumesListQuery({ teamId, projectId, environmentId }),
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

  return <VolumesContext.Provider value={value}>{children}</VolumesContext.Provider>;
};

export const useVolumes = () => {
  const context = useContext(VolumesContext);
  if (!context) {
    throw new Error("useVolumes must be used within a VolumesProvider");
  }
  return context;
};

export default VolumesProvider;

export const useVolumesUtils = ({
  teamId,
  projectId,
  environmentId,
}: {
  teamId: string;
  projectId: string;
  environmentId: string;
}) => {
  const queryClient = useQueryClient();
  const queryKey = queryKeyStorage.volumeList({ teamId, projectId, environmentId });
  return {
    invalidate: () => queryClient.invalidateQueries({ queryKey }),
    refetch: () => queryClient.refetchQueries({ queryKey }),
  };
};
