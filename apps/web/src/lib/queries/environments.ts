import { queryOptions } from "@tanstack/react-query";

import { getGoClient } from "@/server/client";
import type { EnvironmentResponse } from "@/server/client.gen";

export type TEnvironmentShallow = EnvironmentResponse;

export const queryKeyEnvironments = {
  list: (input: { teamId: string; projectId: string }) =>
    ["environments", "list", input.teamId, input.projectId] as const,
  detail: (input: { teamId: string; projectId: string; environmentId: string }) =>
    ["environments", "detail", input.teamId, input.projectId, input.environmentId] as const,
};

// Mirrors the old environments tRPC router (queries + mutations, same reshapes/mappings).
export const environmentsListQuery = (input: { teamId: string; projectId: string }) =>
  queryOptions({
    queryKey: queryKeyEnvironments.list(input),
    queryFn: async () => {
      const res = await getGoClient().environments.list({
        team_id: input.teamId,
        project_id: input.projectId,
      });
      return { environments: res.data };
    },
  });

export const environmentQuery = (input: {
  teamId: string;
  projectId: string;
  environmentId: string;
}) =>
  queryOptions({
    queryKey: queryKeyEnvironments.detail(input),
    queryFn: async () => {
      const res = await getGoClient().environments.get({
        id: input.environmentId,
        team_id: input.teamId,
        project_id: input.projectId,
      });
      return { environment: res.data };
    },
  });

export async function createEnvironment(input: {
  teamId: string;
  projectId: string;
  name: string;
  description?: string;
}) {
  const res = await getGoClient().environments.create({
    name: input.name,
    description: input.description ?? null,
    team_id: input.teamId,
    project_id: input.projectId,
  });
  return { data: res.data };
}

export async function updateEnvironment(input: {
  id: string;
  teamId: string;
  projectId: string;
  name?: string;
  description?: string;
}) {
  const res = await getGoClient().environments.update({
    team_id: input.teamId,
    project_id: input.projectId,
    environment_id: input.id,
    name: input.name === undefined ? null : input.name,
    description: input.description === undefined ? null : input.description,
  });
  return { data: res.data };
}

export async function deleteEnvironment(input: { id: string; teamId: string; projectId: string }) {
  const res = await getGoClient().environments.delete({
    environment_id: input.id,
    team_id: input.teamId,
    project_id: input.projectId,
  });
  return { data: res.data };
}
