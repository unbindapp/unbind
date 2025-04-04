import { list_deploymentsQuerySchema } from "@/server/go/client.gen";
import { createTRPCRouter, publicProcedure } from "@/server/trpc/setup/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

export const deploymentsRouter = createTRPCRouter({
  list: publicProcedure
    .input(
      z
        .object({
          teamId: z.string().uuid(),
          projectId: z.string().uuid(),
          environmentId: z.string().uuid(),
          serviceId: z.string().uuid(),
          cursor: z.string().optional(),
          statuses: list_deploymentsQuerySchema.shape.statuses,
        })
        .strip(),
    )
    .query(async function ({
      input: { teamId, projectId, environmentId, serviceId, cursor, statuses },
      ctx,
    }) {
      const { session, goClient } = ctx;
      if (!session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You need to be logged in to access this resource",
        });
      }
      const deployments = await goClient.deployments.list({
        team_id: teamId,
        project_id: projectId,
        environment_id: environmentId,
        service_id: serviceId,
        cursor,
        statuses,
        per_page: 50,
      });
      return {
        ...deployments.data,
      };
    }),
  create: publicProcedure
    .input(
      z
        .object({
          teamId: z.string().uuid(),
          projectId: z.string().uuid(),
          environmentId: z.string().uuid(),
          serviceId: z.string().uuid(),
        })
        .strip(),
    )
    .mutation(async function ({ input: { teamId, projectId, environmentId, serviceId }, ctx }) {
      const { session, goClient } = ctx;
      if (!session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You need to be logged in to access this resource",
        });
      }
      const deployment = await goClient.deployments.create({
        team_id: teamId,
        project_id: projectId,
        environment_id: environmentId,
        service_id: serviceId,
      });
      return {
        deployment: deployment.data,
      };
    }),
});
