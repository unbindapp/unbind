import { queryOptions } from "@tanstack/react-query";

import { getGoClient } from "@/server/client";
import type {
  AvailableVariableReference,
  VariableReferenceInputItem,
  VariableReferenceSourceType,
  VariablesResponseBody,
  VariableUpdateBehavior,
} from "@/server/client.gen";

export type TVariablesList = VariablesResponseBody["data"];
export type TAvailableVariableReferences = { variables: AvailableVariableReference[] };

export const queryKeyVariables = {
  list: (input: {
    teamId: string;
    projectId?: string;
    environmentId?: string;
    serviceId?: string;
    type: string;
  }) =>
    [
      "variables",
      "list",
      input.teamId,
      input.projectId ?? null,
      input.environmentId ?? null,
      input.serviceId ?? null,
      input.type,
    ] as const,
  available: (input: {
    teamId: string;
    projectId: string;
    environmentId: string;
    serviceId: string;
  }) =>
    ["variables", "available", input.teamId, input.projectId, input.environmentId, input.serviceId] as const,
};

export type TVariablesListInput = {
  teamId: string;
  projectId?: string;
  environmentId?: string;
  serviceId?: string;
  type: VariableReferenceSourceType;
};

export const variablesListQuery = (input: TVariablesListInput) =>
  queryOptions({
    queryKey: queryKeyVariables.list(input),
    queryFn: async (): Promise<TVariablesList> => {
      const res = await getGoClient().variables.list({
        team_id: input.teamId,
        project_id: input.projectId,
        environment_id: input.environmentId,
        service_id: input.serviceId,
        type: input.type,
      });
      return res.data;
    },
  });

export const availableVariableReferencesQuery = (input: {
  teamId: string;
  projectId: string;
  environmentId: string;
  serviceId: string;
}) =>
  queryOptions({
    queryKey: queryKeyVariables.available(input),
    queryFn: async (): Promise<TAvailableVariableReferences> => {
      const res = await getGoClient().variables.references.available({
        team_id: input.teamId,
        environment_id: input.environmentId,
        project_id: input.projectId,
        service_id: input.serviceId,
      });
      return { variables: res.data };
    },
  });

export type TCreateOrUpdateVariablesInput = {
  teamId: string;
  projectId?: string;
  environmentId?: string;
  serviceId?: string;
  variables: { name: string; value: string }[];
  variableReferences?: VariableReferenceInputItem[];
  type: VariableReferenceSourceType;
  behavior?: VariableUpdateBehavior;
};

export async function createOrUpdateVariables(input: TCreateOrUpdateVariablesInput) {
  const res = await getGoClient().variables.update({
    behavior: input.behavior ?? "upsert",
    team_id: input.teamId,
    project_id: input.projectId,
    environment_id: input.environmentId,
    service_id: input.serviceId,
    variables: input.variables,
    variable_references: input.variableReferences,
    type: input.type,
  });
  return { data: res.data };
}

export type TDeleteVariablesInput = {
  teamId: string;
  projectId?: string;
  environmentId?: string;
  serviceId?: string;
  variables: { name: string }[];
  variableReferenceIds: string[];
  type: VariableReferenceSourceType;
};

export async function deleteVariables(input: TDeleteVariablesInput) {
  const res = await getGoClient().variables.delete({
    team_id: input.teamId,
    project_id: input.projectId,
    environment_id: input.environmentId,
    service_id: input.serviceId,
    variables: input.variables,
    variable_reference_ids: input.variableReferenceIds,
    type: input.type,
  });
  return { data: res.data };
}
