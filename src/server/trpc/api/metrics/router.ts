import { MetricsTypeSchema } from "@/server/go/client.gen";
import { createTRPCRouter, publicProcedure } from "@/server/trpc/setup/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

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
          start: z.string().optional(),
          end: z.string().optional(),
        })
        .strip(),
    )
    .query(async function ({
      input: { type, teamId, projectId, environmentId, serviceId, start, end },
      ctx,
    }) {
      const { session, goClient } = ctx;
      if (!session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You need to be logged in to access this resource",
        });
      }
      const metricsData = await goClient.metrics.get({
        type,
        team_id: teamId,
        project_id: projectId,
        environment_id: environmentId,
        service_id: serviceId,
        start,
        end,
      });
      return {
        data: metricsData.data || [],
      };
    }),
});
