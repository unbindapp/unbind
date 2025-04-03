import { MetricsTypeSchema } from "@/server/go/client.gen";
import { MetricsIntervalEnum, TMetricsIntervalEnum } from "@/server/trpc/api/metrics/types";
import { createTRPCRouter, publicProcedure } from "@/server/trpc/setup/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

const intervalToStart: Record<TMetricsIntervalEnum, () => string> = {
  "1h": () => new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  "6h": () => new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
  "24h": () => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  "7d": () => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  "30d": () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
};

export const metricsRouter = createTRPCRouter({
  list: publicProcedure
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
      ctx,
    }) {
      const { session, goClient } = ctx;
      if (!session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You need to be logged in to access this resource",
        });
      }
      const start = intervalToStart[interval]();

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
