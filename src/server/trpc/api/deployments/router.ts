import { list_deploymentsQuerySchema } from "@/server/go/client.gen";
import { createTRPCRouter, privateProcedure } from "@/server/trpc/setup/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

export const deploymentsRouter = createTRPCRouter({
  list: privateProcedure
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
      ctx: { goClient },
    }) {
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
  get: privateProcedure
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
      ctx: { goClient },
    }) {
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
  create: privateProcedure
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
    .mutation(async function ({
      input: { teamId, projectId, environmentId, serviceId },
      ctx: { goClient },
    }) {
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
  redeploy: privateProcedure
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
    .mutation(async function ({
      input: { teamId, projectId, environmentId, serviceId, deploymentId },
      ctx: { goClient },
    }) {
      const result = await goClient.deployments.redeploy({
        team_id: teamId,
        project_id: projectId,
        environment_id: environmentId,
        service_id: serviceId,
        deployment_id: deploymentId,
      });
      return {
        data: result.data,
      };
    }),
});
