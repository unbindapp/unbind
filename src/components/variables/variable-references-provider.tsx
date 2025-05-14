"use client";

import { TEntityVariableTypeProps } from "@/components/variables/types";
import { AppRouterOutputs, AppRouterQueryResult } from "@/server/trpc/api/root";
import { api } from "@/server/trpc/setup/client";
import { createContext, ReactNode, useContext, useMemo } from "react";

type TVariableReferencesContext = {
  list: AppRouterQueryResult<AppRouterOutputs["variables"]["listAvailableVariableReferences"]>;
} & TEntityVariableTypeProps;

const VariableReferencesContext = createContext<TVariableReferencesContext | null>(null);

type TProps = {
  initialData?: AppRouterOutputs["variables"]["listAvailableVariableReferences"];
  refetchInterval?: number;
  children: ReactNode;
} & TEntityVariableTypeProps;

export const VariableReferencesProvider: React.FC<TProps> = ({
  children,
  initialData: initialDataFromProps,
  refetchInterval,
  ...typedProps
}) => {
  const initialData: AppRouterOutputs["variables"]["listAvailableVariableReferences"] | undefined =
    useMemo(() => {
      if (typedProps.type === "service") {
        return initialDataFromProps;
      }
      return {
        variables: [],
      };
    }, [initialDataFromProps, typedProps.type]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { service, ...queryProps } = typedProps;
  const list = api.variables.listAvailableVariableReferences.useQuery(
    // @ts-expect-error - this is fine for now - TODO - fix this
    {
      ...queryProps,
    },
    {
      initialData: typedProps.type === "service" ? initialData : { variables: [] },
      enabled: typedProps.type === "service",
      refetchInterval,
      trpc: { context: { skipBatch: true } },
    },
  );

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
  const utils = api.useUtils();
  return {
    invalidate:
      type === "service"
        ? () =>
            utils.variables.listAvailableVariableReferences.invalidate({
              teamId,
              projectId,
              environmentId,
              serviceId,
            })
        : () => null,
    refetch:
      type === "service"
        ? () =>
            utils.variables.listAvailableVariableReferences.refetch({
              teamId,
              projectId,
              environmentId,
              serviceId,
            })
        : () => null,
  };
};
