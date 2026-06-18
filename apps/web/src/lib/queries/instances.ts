import { queryOptions } from "@tanstack/react-query";

import { getGoClient } from "@/server/client";
import { queryKeys } from "@/lib/queries/query-keys";
import type { GetInstanceHealthResponseBody, ListInstancesResponseBody } from "@/server/client.gen";

export type TInstancesList = { data: ListInstancesResponseBody["data"] };
export type TInstanceHealth = { data: GetInstanceHealthResponseBody["data"] };

export const instancesListQuery = (input: {
  teamId: string;
  projectId: string;
  environmentId: string;
  serviceId: string;
}) =>
  queryOptions({
    queryKey: queryKeys.instances.list(input),
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
    queryKey: queryKeys.instances.health(input),
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
