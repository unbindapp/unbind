import { MetricsTypeSchema } from "@/server/go/client.gen";
import { MetricsIntervalEnum, TMetricsIntervalEnum } from "@/server/trpc/api/metrics/types";
import { createTRPCRouter, privateProcedure } from "@/server/trpc/setup/trpc";
import { z } from "zod";

function intervalToStart(interval: TMetricsIntervalEnum): string {
  let defaultDuration = 24 * 60 * 60 * 1000;

  if (interval === "5m") defaultDuration = 5 * 60 * 1000;
  else if (interval === "15m") defaultDuration = 15 * 60 * 1000;
  else if (interval === "1h") defaultDuration = 60 * 60 * 1000;
  else if (interval === "6h") defaultDuration = 6 * 60 * 60 * 1000;
  else if (interval === "7d") defaultDuration = 7 * 24 * 60 * 60 * 1000;
  else if (interval === "30d") defaultDuration = 30 * 24 * 60 * 60 * 1000;

  const start = new Date(Date.now() - defaultDuration).toISOString();
  return start;
}

export const metricsRouter = createTRPCRouter({
  list: privateProcedure
    .input(
      z
        .object({
          type: MetricsTypeSchema,
          teamId: z.string().uuid(),
          projectId: z.string().uuid().optional(),
          environmentId: z.string().uuid().optional(),
          serviceId: z.string().uuid().optional(),
          interval: MetricsIntervalEnum,
        })
        .strip(),
    )
    .query(async function ({
      input: { type, teamId, projectId, environmentId, serviceId, interval },
      ctx: { goClient },
    }) {
      const start = intervalToStart(interval);

      const metricsData = await goClient.metrics.get({
        type,
        team_id: teamId,
        project_id: projectId,
        environment_id: environmentId,
        service_id: serviceId,
        start,
      });
      return {
        ...metricsData.data,
      };
    }),
});
