"use client";

import { queryKeys } from "@/api/query-keys";
import {
  availableVariableReferencesQuery,
  type TAvailableVariableReferences,
} from "@/api/queries/variables";
import { TEntityVariableTypeProps } from "@/components/variables/types";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { createContext, ReactNode, useContext, useMemo } from "react";

type TVariableReferencesContext = {
  list: UseQueryResult<TAvailableVariableReferences, Error>;
} & TEntityVariableTypeProps;

const VariableReferencesContext = createContext<TVariableReferencesContext | null>(null);

type TProps = {
  initialData?: TAvailableVariableReferences;
  refetchInterval?: number;
  children: ReactNode;
} & TEntityVariableTypeProps;

export const VariableReferencesProvider: React.FC<TProps> = ({
  children,
  initialData: initialDataFromProps,
  refetchInterval,
  ...typedProps
}) => {
  const isService = typedProps.type === "service";

  const initialData: TAvailableVariableReferences | undefined = useMemo(() => {
    if (isService) return initialDataFromProps;
    return { variables: [] };
  }, [initialDataFromProps, isService]);

  const list = useQuery({
    ...availableVariableReferencesQuery(
      typedProps.teamId,
      typedProps.projectId ?? "",
      typedProps.environmentId ?? "",
      typedProps.serviceId ?? "",
    ),
    enabled: isService,
    initialData: isService ? initialData : { variables: [] },
    refetchInterval,
  });

  const value: TVariableReferencesContext = useMemo(
    () => ({
      list,
      ...typedProps,
    }),
    [list, typedProps],
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
  type,
  teamId,
  projectId,
  environmentId,
  serviceId,
}: TEntityVariableTypeProps) => {
  const queryClient = useQueryClient();
  if (type !== "service") {
    return { invalidate: () => null, refetch: () => null };
  }
  const queryKey = queryKeys.variables.available(teamId, projectId, environmentId, serviceId);
  return {
    invalidate: () => queryClient.invalidateQueries({ queryKey }),
    refetch: () => queryClient.refetchQueries({ queryKey }),
  };
};
