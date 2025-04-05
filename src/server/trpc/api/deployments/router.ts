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
  get: publicProcedure
    .input(
      z
        .object({
          teamId: z.string().uuid(),
          projectId: z.string().uuid(),
          environmentId: z.string().uuid(),
          serviceId: z.string().uuid(),
          deploymentId: z.string().uuid(),
        })
        .strip(),
    )
    .query(async function ({
      input: { teamId, projectId, environmentId, serviceId, deploymentId },
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
        per_page: 50,
      });
      const deployment = deployments.data.deployments?.find((d) => d.id === deploymentId);
      if (!deployment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Deployment not found",
        });
      }
      return {
        deployment,
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
