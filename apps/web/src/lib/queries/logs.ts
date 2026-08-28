import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";

import { getGoClient } from "@/lib/server/client";
import { LogEventSchema, LogLevelSchema, query_logsQuerySchema } from "@/lib/server/client.gen";

export type TLogsListInput = {
  type: TLogType;
  teamId: string;
  projectId?: string;
  environmentId?: string;
  serviceId?: string;
  deploymentId?: string;
  search?: string;
  levels?: string;
  serviceIds?: string;
  start?: string;
  end?: string;
  limit?: number;
  cursor?: string;
};

export const queryKeyLogs = {
  list: (input: TLogsListInput) =>
    [
      "logs",
      "list",
      input.type,
      input.teamId,
      input.projectId ?? null,
      input.environmentId ?? null,
      input.serviceId ?? null,
      input.deploymentId ?? null,
      input.search ?? null,
      input.levels ?? null,
      input.serviceIds ?? null,
      input.start ?? null,
      input.end ?? null,
      input.limit ?? null,
      input.cursor ?? null,
    ] as const,
};

export async function fetchLogsPage(input: TLogsListInput): Promise<TLogsPage> {
  const res = await getGoClient().logs.query({
    type: input.type,
    team_id: input.teamId,
    project_id: input.projectId,
    environment_id: input.environmentId,
    service_id: input.serviceId,
    deployment_id: input.deploymentId,
    search: input.search || undefined,
    levels: input.levels || undefined,
    service_ids: input.serviceIds || undefined,
    start: input.start,
    end: input.end,
    limit: input.limit ?? 1000,
    cursor: input.cursor,
    direction: "backward",
  });

  // server returns newest first; the viewer renders oldest first
  return { logs: [...res.data].reverse(), nextCursor: res.next_cursor };
}

export const logsListQuery = (input: TLogsListInput) =>
  queryOptions({
    queryKey: queryKeyLogs.list(input),
    queryFn: () => fetchLogsPage(input),
  });

// ---- Types ----

export type TLogType = z.infer<typeof query_logsQuerySchema.shape.type>;

export type TLogLine = z.infer<typeof LogEventSchema>;
export type TLogLevel = z.infer<typeof LogLevelSchema>;

export type TLogsPage = {
  logs: TLogLine[];
  nextCursor?: string;
};
