import { queryOptions } from "@tanstack/react-query";

import { getGoClient } from "@/server/client";
import { queryKeys } from "@/lib/queries/query-keys";
import type { DeploymentResponse, ListDeploymentsResponseBody } from "@/server/client.gen";

export type TDeploymentsList = ListDeploymentsResponseBody["data"];
export type TDeployment = DeploymentResponse;

export const deploymentsListQuery = (input: {
  teamId: string;
  projectId: string;
  environmentId: string;
  serviceId: string;
}) =>
  queryOptions({
    queryKey: queryKeys.deployments.list(input),
    queryFn: async (): Promise<TDeploymentsList> => {
      const res = await getGoClient().deployments.list({
        team_id: input.teamId,
        project_id: input.projectId,
        environment_id: input.environmentId,
        service_id: input.serviceId,
        per_page: 50,
      });
      return res.data;
    },
  });

// Mirrors the old router: the API has no single-deployment GET, so list + find by id.
export const deploymentQuery = (input: {
  teamId: string;
  projectId: string;
  environmentId: string;
  serviceId: string;
  deploymentId: string;
}) =>
  queryOptions({
    queryKey: queryKeys.deployments.detail(input),
    queryFn: async (): Promise<{ deployment: TDeployment }> => {
      const res = await getGoClient().deployments.list({
        team_id: input.teamId,
        project_id: input.projectId,
        environment_id: input.environmentId,
        service_id: input.serviceId,
        per_page: 50,
      });
      const deployment = res.data.deployments?.find((d) => d.id === input.deploymentId);
      if (!deployment) throw new Error("Deployment not found");
      return { deployment };
    },
  });

export async function createDeployment(input: {
  teamId: string;
  projectId: string;
  environmentId: string;
  serviceId: string;
}) {
  const res = await getGoClient().deployments.create({
    team_id: input.teamId,
    project_id: input.projectId,
    environment_id: input.environmentId,
    service_id: input.serviceId,
  });
  return { deployment: res.data };
}

export async function redeployDeployment(input: {
  teamId: string;
  projectId: string;
  environmentId: string;
  serviceId: string;
  deploymentId: string;
  skipBuildIfPossible?: boolean;
}) {
  const res = await getGoClient().deployments.redeploy({
    team_id: input.teamId,
    project_id: input.projectId,
    environment_id: input.environmentId,
    service_id: input.serviceId,
    deployment_id: input.deploymentId,
    smart_redeploy: input.skipBuildIfPossible,
  });
  return { data: res.data };
}
