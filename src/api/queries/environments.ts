import { queryOptions } from "@tanstack/react-query";

import { getGoClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import type { EnvironmentResponse } from "@/server/go/client.gen";

export type TEnvironmentShallow = EnvironmentResponse;

// Mirrors the old environments tRPC router (queries + mutations, same reshapes/mappings).
export const environmentsListQuery = (teamId: string, projectId: string) =>
  queryOptions({
    queryKey: queryKeys.environments.list(teamId, projectId),
    queryFn: async () => {
      const res = await getGoClient().environments.list({
        team_id: teamId,
        project_id: projectId,
      });
      return { environments: res.data };
    },
  });

export const environmentQuery = (teamId: string, projectId: string, id: string) =>
  queryOptions({
    queryKey: queryKeys.environments.detail(teamId, projectId, id),
    queryFn: async () => {
      const res = await getGoClient().environments.get({
        id,
        team_id: teamId,
        project_id: projectId,
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

export async function deleteEnvironment(input: {
  id: string;
  teamId: string;
  projectId: string;
}) {
  const res = await getGoClient().environments.delete({
    environment_id: input.id,
    team_id: input.teamId,
    project_id: input.projectId,
  });
  return { data: res.data };
}
