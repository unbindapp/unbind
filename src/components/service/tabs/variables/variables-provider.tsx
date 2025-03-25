"use client";

import { AppRouterOutputs, AppRouterQueryResult } from "@/server/trpc/api/root";
import { api } from "@/server/trpc/setup/client";
import { createContext, ReactNode, useContext, useMemo } from "react";

type TVariablesContext = {
  list: AppRouterQueryResult<AppRouterOutputs["variables"]["list"]>;
  upsert: ReturnType<typeof api.variables.upsert.useMutation>;
  teamId: string;
  projectId: string;
  environmentId: string;
  serviceId: string;
};

const VariablesContext = createContext<TVariablesContext | null>(null);

export const VariablesProvider: React.FC<{
  teamId: string;
  projectId: string;
  environmentId: string;
  serviceId: string;
  children: ReactNode;
}> = ({ teamId, projectId, environmentId, serviceId, children }) => {
  const list = api.variables.list.useQuery({
    teamId,
    projectId,
    environmentId,
    serviceId,
    type: "service",
  });

  const upsert = api.variables.upsert.useMutation();

  const value: TVariablesContext = useMemo(
    () => ({
      list,
      upsert,
      teamId,
      projectId,
      environmentId,
      serviceId,
    }),
    [list, upsert, teamId, projectId, environmentId, serviceId],
  );

  return <VariablesContext.Provider value={value}>{children}</VariablesContext.Provider>;
};

export const useVariables = () => {
  const context = useContext(VariablesContext);
  if (!context) {
    throw new Error("useVariables must be used within an VariablesProvider");
  }
  return context;
};

export default VariablesProvider;

export const useVariablesUtils = ({
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
      utils.variables.list.invalidate({
        teamId,
        projectId,
        environmentId,
        serviceId,
        type: "service",
      }),
    refetch: () =>
      utils.variables.list.refetch({
        teamId,
        projectId,
        environmentId,
        serviceId,
        type: "service",
      }),
  };
};
