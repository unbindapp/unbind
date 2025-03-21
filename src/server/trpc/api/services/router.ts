import { createTRPCRouter, publicProcedure } from "@/server/trpc/setup/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

export const servicesRouter = createTRPCRouter({
  list: publicProcedure
    .input(
      z.object({
        teamId: z.string(),
        projectId: z.string(),
        environmentId: z.string(),
      }),
    )
    .query(async function ({ input: { teamId, projectId, environmentId }, ctx }) {
      const { session, goClient } = ctx;
      if (!session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You need to be logged in to access this resource",
        });
      }
      const services = await goClient.services.list({
        team_id: teamId,
        project_id: projectId,
        environment_id: environmentId,
      });
      return {
        services: services.data || [],
      };
    }),
  get: publicProcedure
    .input(
      z.object({
        teamId: z.string(),
        projectId: z.string(),
        environmentId: z.string(),
        serviceId: z.string(),
      }),
    )
    .query(async function ({ input: { teamId, projectId, environmentId, serviceId }, ctx }) {
      const { session, goClient } = ctx;
      if (!session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You need to be logged in to access this resource",
        });
      }
      const service = await goClient.services.get({
        team_id: teamId,
        project_id: projectId,
        environment_id: environmentId,
        service_id: serviceId,
      });
      return {
        service: service.data,
      };
    }),
});
