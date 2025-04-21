"use client";

import { AppRouterInputs, AppRouterOutputs, AppRouterQueryResult } from "@/server/trpc/api/root";
import { TVariableShallow } from "@/server/trpc/api/variables/types";
import { api } from "@/server/trpc/setup/client";
import { createContext, ReactNode, useContext, useMemo } from "react";

type TVariablesContext = {
  list: AppRouterQueryResult<AppRouterOutputs["variables"]["list"]>;
  update: ReturnType<typeof api.variables.update.useMutation>;
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
  type: AppRouterInputs["variables"]["list"]["type"];
  children: ReactNode;
}> = ({ teamId, projectId, environmentId, serviceId, type, children }) => {
  const list = api.variables.list.useQuery({
    teamId,
    projectId,
    environmentId,
    serviceId,
    type,
  });

  const update = api.variables.update.useMutation();

  const value: TVariablesContext = useMemo(
    () => ({
      list,
      update,
      teamId,
      projectId,
      environmentId,
      serviceId,
    }),
    [list, update, teamId, projectId, environmentId, serviceId],
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
  type,
}: {
  teamId: string;
  projectId: string;
  environmentId: string;
  serviceId: string;
  type: AppRouterInputs["variables"]["list"]["type"];
}) => {
  const utils = api.useUtils();
  return {
    invalidate: () =>
      utils.variables.list.invalidate({
        teamId,
        projectId,
        environmentId,
        serviceId,
        type,
      }),
    refetch: () =>
      utils.variables.list.refetch({
        teamId,
        projectId,
        environmentId,
        serviceId,
        type,
      }),
    optimisticRemove: (variables: TVariableShallow[]) => {
      utils.variables.list.setData(
        { teamId, projectId, environmentId, serviceId, type },
        (data) => {
          if (!data) return data;
          return {
            ...data,
            variables: {
              ...data.variables,
              items: data.variables.filter((v1) => {
                const shouldRemove = variables.some((v2) =>
                  areVariablesMatching({ variable1: v1, variable2: v2 }),
                );
                return !shouldRemove;
              }),
            },
          };
        },
      );
    },
    setVariables: (variables: TVariableShallow[]) => {
      utils.variables.list.setData(
        { teamId, projectId, environmentId, serviceId, type },
        (old) => ({
          variables,
          variable_references: old?.variable_references || [],
        }),
      );
    },
  };
};

function areVariablesMatching({
  variable1,
  variable2,
}: {
  variable1: TVariableShallow;
  variable2: TVariableShallow;
}) {
  return (
    variable1.name === variable2.name &&
    variable1.value === variable2.value &&
    variable1.type === variable2.type
  );
}
