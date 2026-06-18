"use client";

import { queryKeys } from "@/lib/queries/query-keys";
import {
  createOrUpdateVariables,
  variablesListQuery,
  type TCreateOrUpdateVariablesInput,
  type TVariablesList,
} from "@/lib/queries/variables";
import { TEntityVariableTypeProps } from "@/components/variables/types";
import { TVariableReferenceShallow, TVariableShallow } from "@/server/types/variables";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import { createContext, ReactNode, useContext, useMemo } from "react";

type TVariablesContext = {
  list: UseQueryResult<TVariablesList, Error>;
  createOrUpdate: UseMutationResult<
    Awaited<ReturnType<typeof createOrUpdateVariables>>,
    Error,
    TCreateOrUpdateVariablesInput
  >;
} & Omit<TEntityVariableTypeProps, "service">;

const VariablesContext = createContext<TVariablesContext | null>(null);

type TProps = {
  initialData?: TVariablesList;
  refetchInterval?: number;
  children: ReactNode;
} & Omit<TEntityVariableTypeProps, "service">;

export const VariablesProvider: React.FC<TProps> = ({
  initialData,
  refetchInterval,
  children,
  ...typedProps
}) => {
  const list = useQuery({
    ...variablesListQuery(typedProps),
    initialData,
    refetchInterval,
  });

  const createOrUpdate = useMutation({ mutationFn: createOrUpdateVariables });

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
  const queryClient = useQueryClient();
  const queryKey = queryKeys.variables.list({ teamId, projectId, environmentId, serviceId, type });
  return {
    invalidate: () => queryClient.invalidateQueries({ queryKey }),
    refetch: () => queryClient.refetchQueries({ queryKey }),
    optimisticRemove: ({
      variables,
      variableReferences,
    }: {
      variables: TVariableShallow[];
      variableReferences: TVariableReferenceShallow[];
    }) => {
      queryClient.setQueryData<TVariablesList>(queryKey, (data) => {
        if (!data) return data;
        return {
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
      });
    },
    setVariables: (variables: TVariableShallow[]) => {
      queryClient.setQueryData<TVariablesList>(queryKey, (old) => ({
        variables,
        variable_references: old?.variable_references || [],
      }));
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
