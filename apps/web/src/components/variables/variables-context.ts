import type { TStagedVariable } from "@/components/staged-changes/staged-changes-provider";
import type { TStagedState } from "@/components/staged-changes/staged-chip";
import type { TVariableScope } from "@/components/staged-changes/types";
import type { TEntityVariableTypeProps } from "@/components/variables/types";
import type { TVariableShallow, TVariablesList } from "@/lib/queries/variables";
import type { UseQueryResult } from "@tanstack/react-query";
import { createContext } from "react";

// Lives apart from the provider so a hot reload of the provider keeps the same context object
export type TVariableWithStaged = TVariableShallow & {
  staged?: TStagedState;
  // The value the server has while an update is staged
  stagedPrevious?: string;
  // The change is being deployed and the row waits for the refetch
  isApplying?: boolean;
};

export type TStageInput = { name: string; value: string | null };

export type TVariablesContext = {
  list: UseQueryResult<TVariablesList, Error>;
  // Server variables with the staged changes applied on top
  variables: TVariableWithStaged[] | undefined;
  // Computed endpoint values, read-only
  provided: TVariableShallow[] | undefined;
  scope: TVariableScope;
  scopeName: string;
  staged: Map<string, TStagedVariable>;
  // Stages values against what the server has, so re-staging the server value clears the change
  stage: (changes: TStageInput[]) => void;
  discardStaged: (names: string[]) => void;
} & Omit<TEntityVariableTypeProps, "service">;

export const VariablesContext = createContext<TVariablesContext | null>(null);
