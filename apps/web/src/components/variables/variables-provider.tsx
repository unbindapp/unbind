"use client";

import { useChangesStore, useStagedVariables } from "@/components/changes/changes-provider";
import type { TStagedVariableChange, TVariableScope } from "@/components/changes/types";
import { TEntityVariableTypeProps } from "@/components/variables/types";
import {
  queryKeyVariables,
  variablesListQuery,
  type TVariableReferenceInfo,
  type TVariableShallow,
  type TVariablesList,
} from "@/lib/queries/variables";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { createContext, ReactNode, useCallback, useContext, useMemo } from "react";

export type TStagedState = "new" | "updated" | "deleted";

export type TVariableWithStaged = TVariableShallow & {
  staged?: TStagedState;
  // The value the server has while an update is staged
  stagedPrevious?: string;
};

type TStageInput = { name: string; value: string | null };

type TVariablesContext = {
  list: UseQueryResult<TVariablesList, Error>;
  // Server variables with the staged changes applied on top
  variables: TVariableWithStaged[] | undefined;
  scope: TVariableScope;
  scopeName: string;
  staged: Map<string, TStagedVariableChange>;
  // Stages values against what the server has, so re-staging the server value clears the change
  stage: (changes: TStageInput[]) => void;
  discardStaged: (names: string[]) => void;
} & Omit<TEntityVariableTypeProps, "service">;

const VariablesContext = createContext<TVariablesContext | null>(null);

type TProps = {
  initialData?: TVariablesList;
  refetchInterval?: number;
  scopeName?: string;
  children: ReactNode;
} & Omit<TEntityVariableTypeProps, "service">;

const defaultScopeNames: Record<TEntityVariableTypeProps["type"], string> = {
  team: "Team Variables",
  project: "Project Variables",
  service: "Service",
};

export const VariablesProvider: React.FC<TProps> = ({
  initialData,
  refetchInterval,
  scopeName,
  children,
  ...typedProps
}) => {
  const list = useQuery({
    ...variablesListQuery(typedProps),
    initialData,
    refetchInterval,
  });

  const scope = useMemo<TVariableScope>(
    () => ({
      type: typedProps.type,
      teamId: typedProps.teamId,
      projectId: typedProps.projectId,
      environmentId: typedProps.environmentId,
      serviceId: typedProps.serviceId,
    }),
    [
      typedProps.type,
      typedProps.teamId,
      typedProps.projectId,
      typedProps.environmentId,
      typedProps.serviceId,
    ],
  );
  const resolvedScopeName = scopeName ?? defaultScopeNames[typedProps.type];

  const staged = useStagedVariables(scope);
  const stageVariables = useChangesStore((s) => s.stageVariables);
  const discard = useChangesStore((s) => s.discard);

  const serverVariables = list.data?.variables;
  const variables = useMemo(
    () => (serverVariables ? mergeStagedVariables(serverVariables, staged) : undefined),
    [serverVariables, staged],
  );

  const stage = useCallback(
    (changes: TStageInput[]) => {
      const serverByName = new Map((serverVariables ?? []).map((v) => [v.name, v.value]));
      stageVariables(
        changes.map((change) => ({
          scope,
          scopeName: resolvedScopeName,
          name: change.name,
          value: change.value,
          previous: serverByName.get(change.name) ?? null,
        })),
      );
    },
    [serverVariables, stageVariables, scope, resolvedScopeName],
  );

  const discardStaged = useCallback(
    (names: string[]) => {
      const ids = names.flatMap((name) => {
        const change = staged.get(name);
        return change ? [change.id] : [];
      });
      discard(ids);
    },
    [staged, discard],
  );

  const value: TVariablesContext = useMemo(
    () => ({
      list,
      variables,
      scope,
      scopeName: resolvedScopeName,
      staged,
      stage,
      discardStaged,
      ...typedProps,
    }),
    [list, variables, scope, resolvedScopeName, staged, stage, discardStaged, typedProps],
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

export function mergeStagedVariables(
  variables: TVariableShallow[],
  staged: Map<string, TStagedVariableChange>,
): TVariableWithStaged[] {
  const merged: TVariableWithStaged[] = variables.map((variable) => {
    const change = staged.get(variable.name);
    if (!change) return variable;
    if (change.value === null) return { ...variable, staged: "deleted" };
    return {
      ...variable,
      value: change.value,
      resolved_value: undefined,
      references: referencesInStoredValue(change.value),
      staged: "updated",
      stagedPrevious: variable.value,
    };
  });

  const existing = new Set(variables.map((v) => v.name));
  for (const change of staged.values()) {
    if (existing.has(change.name) || change.value === null) continue;
    merged.push({
      type: change.scope.type,
      name: change.name,
      value: change.value,
      references: referencesInStoredValue(change.value),
      staged: "new",
    });
  }
  // Staged variables come first so they are easy to spot, newest staged at the top
  const stagedOrder = new Map(
    [...staged.values()].map((change) => [change.name, change.createdAt]),
  );
  return merged
    .map((variable, index) => ({ variable, index }))
    .sort((a, b) => {
      const aStaged = stagedOrder.get(a.variable.name);
      const bStaged = stagedOrder.get(b.variable.name);
      if (aStaged !== undefined && bStaged !== undefined) return bStaged - aStaged;
      if (aStaged !== undefined) return -1;
      if (bStaged !== undefined) return 1;
      return a.index - b.index;
    })
    .map(({ variable }) => variable);
}

// Staged values are not rendered by the server, so their references only carry the
// token: known ones still display in their readable form, unknown ones stay literal
export function referencesInStoredValue(value: string): TVariableReferenceInfo[] {
  const matches = value.match(/\$\{\{[^}]*\}\}/g) ?? [];
  return [...new Set(matches)].map((token) => ({
    token,
    key: "",
    resolved: true,
    source_icon: "",
    source_id: "",
    source_name: "",
    source_type: "team",
  }));
}

export const useVariablesUtils = ({
  teamId,
  projectId,
  environmentId,
  serviceId,
  type,
}: Omit<TEntityVariableTypeProps, "service">) => {
  const queryClient = useQueryClient();
  const queryKey = queryKeyVariables.list({ teamId, projectId, environmentId, serviceId, type });
  return {
    invalidate: () => queryClient.invalidateQueries({ queryKey }),
    refetch: () => queryClient.refetchQueries({ queryKey }),
    setVariables: (variables: TVariableShallow[]) => {
      queryClient.setQueryData<TVariablesList>(queryKey, () => ({ variables }));
    },
  };
};
