"use client";

import { TEntityVariableTypeProps } from "@/components/variables/types";
import { AppRouterOutputs, AppRouterQueryResult } from "@/server/trpc/api/root";
import { TVariableReferenceShallow, TVariableShallow } from "@/server/trpc/api/variables/types";
import { api } from "@/server/trpc/setup/client";
import { createContext, ReactNode, useContext, useMemo } from "react";

type TVariablesContext = {
  list: AppRouterQueryResult<AppRouterOutputs["variables"]["list"]>;
  createOrUpdate: ReturnType<typeof api.variables.createOrUpdate.useMutation>;
} & TEntityVariableTypeProps;

const VariablesContext = createContext<TVariablesContext | null>(null);

type TProps = {
  initialData?: AppRouterOutputs["variables"]["list"];
  refetchInterval?: number;
  children: ReactNode;
} & TEntityVariableTypeProps;

export const VariablesProvider: React.FC<TProps> = ({
  initialData,
  refetchInterval,
  children,
  ...typedProps
}) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { service, ...queryProps } = typedProps;
  const list = api.variables.list.useQuery(
    {
      ...queryProps,
    },
    { initialData, refetchInterval },
  );

  const createOrUpdate = api.variables.createOrUpdate.useMutation();

  const value: TVariablesContext = useMemo(
    () => ({
      list,
      createOrUpdate,
      ...typedProps,
    }),
    [list, createOrUpdate, typedProps],
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
}: Omit<TEntityVariableTypeProps, "service">) => {
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
    optimisticRemove: ({
      variables,
      variableReferences,
    }: {
      variables: TVariableShallow[];
      variableReferences: TVariableReferenceShallow[];
    }) => {
      utils.variables.list.setData(
        { teamId, projectId, environmentId, serviceId, type },
        (data) => {
          if (!data) return data;
          const newData: AppRouterOutputs["variables"]["list"] = {
            ...data,
            variables: data.variables.filter((v1) => {
              const shouldRemove = variables.some((v2) =>
                areVariablesMatching({ variable1: v1, variable2: v2 }),
              );
              return !shouldRemove;
            }),
            variable_references: data.variable_references.filter((v1) => {
              const shouldRemove = variableReferences.some((v2) => v1.id === v2.id);
              return !shouldRemove;
            }),
          };
          return newData;
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
