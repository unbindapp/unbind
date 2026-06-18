import { queryOptions } from "@tanstack/react-query";

import { getGoClient } from "@/server/client";
import type { GetInstanceHealthResponseBody, ListInstancesResponseBody } from "@/server/client.gen";

export type TInstancesList = { data: ListInstancesResponseBody["data"] };
export type TInstanceHealth = { data: GetInstanceHealthResponseBody["data"] };

export const queryKeyInstances = {
  list: (input: { teamId: string; projectId: string; environmentId: string; serviceId: string }) =>
    ["instances", "list", input.teamId, input.projectId, input.environmentId, input.serviceId] as const,
  health: (input: {
    teamId: string;
    projectId: string;
    environmentId: string;
    serviceId: string;
  }) =>
    ["instances", "health", input.teamId, input.projectId, input.environmentId, input.serviceId] as const,
};

export const instancesListQuery = (input: {
  teamId: string;
  projectId: string;
  environmentId: string;
  serviceId: string;
}) =>
  queryOptions({
    queryKey: queryKeyInstances.list(input),
    queryFn: async (): Promise<TInstancesList> => {
      const res = await getGoClient().instances.list({
        type: "service",
        team_id: input.teamId,
        project_id: input.projectId,
        environment_id: input.environmentId,
        service_id: input.serviceId,
      });
      return { data: res.data };
    },
  });

export const instanceHealthQuery = (input: {
  teamId: string;
  projectId: string;
  environmentId: string;
  serviceId: string;
}) =>
  queryOptions({
    queryKey: queryKeyInstances.health(input),
    queryFn: async (): Promise<TInstanceHealth> => {
      const res = await getGoClient().instances.health({
        type: "service",
        team_id: input.teamId,
        project_id: input.projectId,
        environment_id: input.environmentId,
        service_id: input.serviceId,
      });
      return { data: res.data };
    },
  });

export async function restartInstances(input: {
  teamId: string;
  projectId: string;
  environmentId: string;
  serviceId: string;
}) {
  const res = await getGoClient().instances.restart({
    team_id: input.teamId,
    project_id: input.projectId,
    environment_id: input.environmentId,
    service_id: input.serviceId,
  });
  return { data: res.data };
}
