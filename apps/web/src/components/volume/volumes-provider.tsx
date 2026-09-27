"use client";

import { queryKeyStorage, volumesListQuery } from "@/lib/queries/storage";
import { useDiscardChangesForMissing } from "@/components/staged-changes/staged-changes-provider";
import { VolumesContext, type TVolumesResult } from "@/components/volume/volumes-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ReactNode, useContext, useMemo } from "react";

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
  // A cached list can be older than the changes, so only a list fetched now can drop them
  const volumeIds = useMemo(
    () => (query.isFetchedAfterMount ? query.data?.volumes.map((item) => item.id) : undefined),
    [query.data, query.isFetchedAfterMount],
  );
  useDiscardChangesForMissing(environmentId, { volumeIds });
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
