"use client";

import { AppRouterOutputs, AppRouterQueryResult } from "@/server/trpc/api/root";
import { api } from "@/server/trpc/setup/client";
import { createContext, ReactNode, useContext, useMemo } from "react";

type TVariableReferencesContext = {
  list: AppRouterQueryResult<AppRouterOutputs["variables"]["listAvailableVariableReferences"]>;
  teamId: string;
  projectId: string;
  environmentId: string;
  serviceId: string;
};

const VariableReferencesContext = createContext<TVariableReferencesContext | null>(null);

export const VariableReferencesProvider: React.FC<{
  teamId: string;
  projectId: string;
  environmentId: string;
  serviceId: string;
  children: ReactNode;
}> = ({ teamId, projectId, environmentId, serviceId, children }) => {
  const list = api.variables.listAvailableVariableReferences.useQuery({
    teamId,
    projectId,
    environmentId,
    serviceId,
  });

  const value: TVariableReferencesContext = useMemo(
    () => ({
      list,
      teamId,
      projectId,
      environmentId,
      serviceId,
    }),
    [list, teamId, projectId, environmentId, serviceId],
  );

  return (
    <VariableReferencesContext.Provider value={value}>
      {children}
    </VariableReferencesContext.Provider>
  );
};

export const useVariableReferences = () => {
  const context = useContext(VariableReferencesContext);
  if (!context) {
    throw new Error("useVariableReferences must be used within an VariableReferencesProvider");
  }
  return context;
};

export default VariableReferencesProvider;

export const useVariableReferenceUtils = ({
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
      utils.variables.listAvailableVariableReferences.invalidate({
        teamId,
        projectId,
        environmentId,
        serviceId,
      }),
    refetch: () =>
      utils.variables.listAvailableVariableReferences.refetch({
        teamId,
        projectId,
        environmentId,
        serviceId,
      }),
  };
};
