import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";

import { getGoClient } from "@/lib/server/client";
import type { GetMetricsResponseBody, MetricsType } from "@/lib/server/client.gen";

function intervalToStart(interval: TMetricsIntervalEnum): string {
  let defaultDuration = 24 * 60 * 60 * 1000;

  if (interval === "5m") defaultDuration = 5 * 60 * 1000;
  else if (interval === "15m") defaultDuration = 15 * 60 * 1000;
  else if (interval === "1h") defaultDuration = 60 * 60 * 1000;
  else if (interval === "6h") defaultDuration = 6 * 60 * 60 * 1000;
  else if (interval === "7d") defaultDuration = 7 * 24 * 60 * 60 * 1000;
  else if (interval === "30d") defaultDuration = 30 * 24 * 60 * 60 * 1000;

  return new Date(Date.now() - defaultDuration).toISOString();
}

export type TMetricsListInput = {
  type: MetricsType;
  teamId: string;
  projectId?: string;
  environmentId?: string;
  serviceId?: string;
  interval: TMetricsIntervalEnum;
};

export const queryKeyMetrics = {
  list: (input: {
    type: string;
    teamId: string;
    projectId?: string;
    environmentId?: string;
    serviceId?: string;
    interval: string;
  }) =>
    [
      "metrics",
      "list",
      input.type,
      input.teamId,
      input.projectId ?? null,
      input.environmentId ?? null,
      input.serviceId ?? null,
      input.interval,
    ] as const,
};

export const metricsListQuery = (input: TMetricsListInput) =>
  queryOptions({
    queryKey: queryKeyMetrics.list(input),
    queryFn: async (): Promise<TMetrics> => {
      const res = await getGoClient().metrics.get({
        type: input.type,
        team_id: input.teamId,
        project_id: input.projectId,
        environment_id: input.environmentId,
        service_id: input.serviceId,
        start: intervalToStart(input.interval),
      });
      return res.data;
    },
  });

// ---- Types ----

export type TMetrics = GetMetricsResponseBody["data"];

export const MetricsIntervalEnum = z.enum(["5m", "15m", "1h", "6h", "24h", "7d", "30d"]);
export type TMetricsIntervalEnum = z.infer<typeof MetricsIntervalEnum>;
