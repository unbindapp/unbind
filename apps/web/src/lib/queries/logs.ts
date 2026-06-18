import { queryOptions } from "@tanstack/react-query";

import { getGoClient } from "@/server/client";
import { queryKeys } from "@/lib/queries/query-keys";
import { getLogLevelFromMessage } from "@/lib/helpers/get-log-level-from-message";
import type { TLogLineWithLevel, TLogType } from "@/server/types/logs";

export type TLogsListInput = {
  type: TLogType;
  teamId: string;
  projectId?: string;
  environmentId?: string;
  serviceId?: string;
  deploymentId?: string;
  filters?: string;
  since?: "24h" | "1w" | "1m";
  start?: string;
  end?: string;
  limit?: number;
};

export const logsListQuery = (input: TLogsListInput) =>
  queryOptions({
    queryKey: queryKeys.logs.list(input),
    queryFn: async (): Promise<{ logs: TLogLineWithLevel[] }> => {
      const res = await getGoClient().logs.query({
        type: input.type,
        team_id: input.teamId,
        project_id: input.projectId,
        environment_id: input.environmentId,
        service_id: input.serviceId,
        deployment_id: input.deploymentId,
        filters: input.filters,
        since: input.since,
        start: input.start,
        end: input.end,
        limit: input.limit ?? 500,
        direction: "backward",
      });

      const logs = res.data
        .map((logLine) => ({ ...logLine, level: getLogLevelFromMessage(logLine.message) }))
        .reverse();

      return { logs };
    },
  });
