import { query_logsQuerySchema } from "@/server/go/client.gen";
import { createTRPCRouter, publicProcedure } from "@/server/trpc/setup/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

export const logsRouter = createTRPCRouter({
  list: publicProcedure
    .input(
      z
        .object({
          type: query_logsQuerySchema.shape.type,
          teamId: z.string().uuid(),
          projectId: z.string().uuid().optional(),
          environmentId: z.string().uuid().optional(),
          serviceId: z.string().uuid().optional(),
          deploymentId: z.string().uuid().optional(),
          filters: z.string().optional(),
          since: z.enum(["24h", "1w", "1m"]).optional(),
          limit: z.number().optional().default(500),
        })
        .strip(),
    )
    .query(async function ({
      input: {
        type,
        teamId,
        projectId,
        environmentId,
        serviceId,
        deploymentId,
        filters,
        since,
        limit,
      },
      ctx,
    }) {
      const { session, goClient } = ctx;
      if (!session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You need to be logged in to access this resource",
        });
      }
      const logsData = await goClient.logs.query({
        team_id: teamId,
        project_id: projectId,
        environment_id: environmentId,
        service_id: serviceId,
        deployment_id: deploymentId,
        filters,
        since,
        type,
        limit,
      });
      return {
        logs: logsData.data,
      };
    }),
});
