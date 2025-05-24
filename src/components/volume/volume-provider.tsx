"use client";

import { AppRouterOutputs, AppRouterQueryResult } from "@/server/trpc/api/root";
import { TVolumeType } from "@/server/trpc/api/storage/volumes/types";
import { api } from "@/server/trpc/setup/client";
import { createContext, ReactNode, useContext, useMemo } from "react";

type TVolumeContext = {
  query: AppRouterQueryResult<AppRouterOutputs["storage"]["volumes"]["get"]>;
  teamId: string;
  projectId: string;
  environmentId: string;
};

const VolumeContext = createContext<TVolumeContext | null>(null);

const type: TVolumeType = "environment";

export const VolumeProvider: React.FC<{
  id: string;
  teamId: string;
  projectId: string;
  environmentId: string;
  children: ReactNode;
}> = ({ id, teamId, projectId, environmentId, children }) => {
  const query = api.storage.volumes.get.useQuery({ id, type, teamId, projectId, environmentId });

  const value = useMemo(
    () => ({ query, teamId, projectId, environmentId, id }),
    [query, teamId, projectId, environmentId, id],
  );

  return <VolumeContext.Provider value={value}>{children}</VolumeContext.Provider>;
};

export const useVolume = () => {
  const context = useContext(VolumeContext);
  if (!context) {
    throw new Error("useVolume must be used within an VolumeProvider");
  }
  return context;
};

export default VolumeProvider;

export const useVolumeUtils = ({
  id,
  type,
  teamId,
  projectId,
  environmentId,
}: {
  id: string;
  type: TVolumeType;
  teamId: string;
  projectId: string;
  environmentId: string;
}) => {
  const utils = api.useUtils();
  return {
    invalidate: () =>
      utils.storage.volumes.get.invalidate({ id, type, teamId, projectId, environmentId }),
    refetch: () =>
      utils.storage.volumes.get.refetch({ id, type, teamId, projectId, environmentId }),
  };
};
