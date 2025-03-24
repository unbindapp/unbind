import { list_secretsQuerySchema } from "@/server/go/client.gen";
import { SecretSchema, SecretTypeSchema } from "@/server/trpc/api/secrets/types";
import { createTRPCRouter, publicProcedure } from "@/server/trpc/setup/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

export const secretsRouter = createTRPCRouter({
  list: publicProcedure
    .input(
      z.object({
        teamId: z.string().uuid(),
        projectId: z.string().uuid().optional(),
        environmentId: z.string().uuid().optional(),
        serviceId: z.string().uuid().optional(),
        type: list_secretsQuerySchema.shape.type,
      }),
    )
    .query(async function ({ input: { teamId, projectId, environmentId, serviceId, type }, ctx }) {
      const { session, goClient } = ctx;
      if (!session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You need to be logged in to access this resource",
        });
      }
      const res = await goClient.secrets.list({
        team_id: teamId,
        project_id: projectId,
        environment_id: environmentId,
        service_id: serviceId,
        type,
      });
      return {
        secrets: res.data || [],
      };
    }),
  create: publicProcedure
    .input(
      z.object({
        teamId: z.string().uuid(),
        projectId: z.string().uuid(),
        environmentId: z.string().uuid(),
        serviceId: z.string().uuid(),
        secrets: z.array(SecretSchema),
        type: SecretTypeSchema,
      }),
    )
    .mutation(async function ({
      input: { teamId, projectId, environmentId, serviceId, secrets, type },
      ctx,
    }) {
      const { session, goClient } = ctx;
      if (!session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You need to be logged in to access this resource",
        });
      }
      const res = await goClient.secrets.upsert({
        team_id: teamId,
        project_id: projectId,
        environment_id: environmentId,
        service_id: serviceId,
        secrets: secrets,
        type,
      });
      return {
        secrets: res.data || [],
      };
    }),
  delete: publicProcedure
    .input(
      z.object({
        teamId: z.string().uuid(),
        projectId: z.string().uuid(),
        environmentId: z.string().uuid(),
        serviceId: z.string().uuid(),
        secrets: z.array(z.object({ name: z.string() })),
        type: SecretTypeSchema,
      }),
    )
    .mutation(async function ({
      input: { teamId, projectId, environmentId, serviceId, secrets, type },
      ctx,
    }) {
      const { session, goClient } = ctx;
      if (!session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You need to be logged in to access this resource",
        });
      }
      const res = await goClient.secrets.delete({
        team_id: teamId,
        project_id: projectId,
        environment_id: environmentId,
        service_id: serviceId,
        secrets,
        type,
      });
      return {
        data: res.data,
      };
    }),
});
