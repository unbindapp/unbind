import { queryOptions } from "@tanstack/react-query";

import { getGoClient } from "@/lib/server/client";
import type { ListCronRunsResponseBody, StartCronRunResponseBody } from "@/lib/server/client.gen";

type TCronRunsInput = {
  teamId: string;
  projectId: string;
  environmentId: string;
  serviceId: string;
};

export const queryKeyCronRuns = {
  list: (input: TCronRunsInput) =>
    ["cron", "runs", input.teamId, input.projectId, input.environmentId, input.serviceId] as const,
};

export const cronRunsListQuery = (input: TCronRunsInput) =>
  queryOptions({
    queryKey: queryKeyCronRuns.list(input),
    queryFn: async (): Promise<TCronRuns> => {
      const res = await getGoClient().cron.runs({
        team_id: input.teamId,
        project_id: input.projectId,
        environment_id: input.environmentId,
        service_id: input.serviceId,
      });
      return { runs: res.data };
    },
  });

export async function startCronRun(input: TCronRunsInput) {
  const res = await getGoClient().cron.run({
    team_id: input.teamId,
    project_id: input.projectId,
    environment_id: input.environmentId,
    service_id: input.serviceId,
  });
  return { run: res.data };
}

// ---- Types ----

export type TCronRuns = { runs: ListCronRunsResponseBody["data"] };
export type TCronRun = ListCronRunsResponseBody["data"][number];
export type TStartedCronRun = { run: StartCronRunResponseBody["data"] };
