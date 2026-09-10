import { queryOptions } from "@tanstack/react-query";

import { getGoClient } from "@/lib/server/client";
import type {
  GetReplicaHealthResponseBody,
  ListReplicasResponseBody,
} from "@/lib/server/client.gen";

export const queryKeyReplicas = {
  list: (input: { teamId: string; projectId: string; environmentId: string; serviceId: string }) =>
    [
      "replicas",
      "list",
      input.teamId,
      input.projectId,
      input.environmentId,
      input.serviceId,
    ] as const,
  health: (input: {
    teamId: string;
    projectId: string;
    environmentId: string;
    serviceId: string;
  }) =>
    [
      "replicas",
      "health",
      input.teamId,
      input.projectId,
      input.environmentId,
      input.serviceId,
    ] as const,
};

export const replicasListQuery = (input: {
  teamId: string;
  projectId: string;
  environmentId: string;
  serviceId: string;
}) =>
  queryOptions({
    queryKey: queryKeyReplicas.list(input),
    queryFn: async (): Promise<TReplicasList> => {
      const res = await getGoClient().replicas.list({
        type: "service",
        team_id: input.teamId,
        project_id: input.projectId,
        environment_id: input.environmentId,
        service_id: input.serviceId,
      });
      return { data: res.data };
    },
  });

export const replicaHealthQuery = (input: {
  teamId: string;
  projectId: string;
  environmentId: string;
  serviceId: string;
}) =>
  queryOptions({
    queryKey: queryKeyReplicas.health(input),
    queryFn: async (): Promise<TReplicaHealth> => {
      const res = await getGoClient().replicas.health({
        type: "service",
        team_id: input.teamId,
        project_id: input.projectId,
        environment_id: input.environmentId,
        service_id: input.serviceId,
      });
      return { data: res.data };
    },
  });

export async function restartReplicas(input: {
  teamId: string;
  projectId: string;
  environmentId: string;
  serviceId: string;
}) {
  const res = await getGoClient().replicas.restart({
    team_id: input.teamId,
    project_id: input.projectId,
    environment_id: input.environmentId,
    service_id: input.serviceId,
  });
  return { data: res.data };
}

// ---- Types ----

export type TReplicasList = { data: ListReplicasResponseBody["data"] };
export type TReplicaHealth = { data: GetReplicaHealthResponseBody["data"] };
export type TReplicaFromHealth = GetReplicaHealthResponseBody["data"]["replicas"][number];
