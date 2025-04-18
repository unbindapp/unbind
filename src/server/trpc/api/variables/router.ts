import {
  list_variablesQuerySchema,
  VariableReferenceSourceTypeSchema,
  VariableUpdateBehaviorSchema,
} from "@/server/go/client.gen";
import { VariableForCreateSchema } from "@/server/trpc/api/variables/types";
import { createTRPCRouter, publicProcedure } from "@/server/trpc/setup/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

export const variablesRouter = createTRPCRouter({
  list: publicProcedure
    .input(
      z
        .object({
          teamId: z.string().uuid(),
          projectId: z.string().uuid().optional(),
          environmentId: z.string().uuid().optional(),
          serviceId: z.string().uuid().optional(),
          type: list_variablesQuerySchema.shape.type,
        })
        .strip(),
    )
    .query(async function ({ input: { teamId, projectId, environmentId, serviceId, type }, ctx }) {
      const { session, goClient } = ctx;
      if (!session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You need to be logged in to access this resource",
        });
      }
      const res = await goClient.variables.list({
        team_id: teamId,
        project_id: projectId,
        environment_id: environmentId,
        service_id: serviceId,
        type,
      });
      return {
        variables: res.data,
      };
    }),
  update: publicProcedure
    .input(
      z
        .object({
          teamId: z.string().uuid(),
          projectId: z.string().uuid(),
          environmentId: z.string().uuid(),
          serviceId: z.string().uuid(),
          variables: z.array(VariableForCreateSchema),
          type: VariableReferenceSourceTypeSchema,
          behavior: VariableUpdateBehaviorSchema.default("upsert"),
        })
        .strip(),
    )
    .mutation(async function ({
      input: { teamId, projectId, environmentId, serviceId, variables, type, behavior },
      ctx,
    }) {
      const { session, goClient } = ctx;
      if (!session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You need to be logged in to access this resource",
        });
      }
      const res = await goClient.variables.update({
        behavior,
        team_id: teamId,
        project_id: projectId,
        environment_id: environmentId,
        service_id: serviceId,
        variables,
        type,
      });
      return {
        variables: res.data,
      };
    }),
  delete: publicProcedure
    .input(
      z
        .object({
          teamId: z.string().uuid(),
          projectId: z.string().uuid(),
          environmentId: z.string().uuid(),
          serviceId: z.string().uuid(),
          variables: z.array(z.object({ name: z.string() }).strip()),
          type: VariableReferenceSourceTypeSchema,
        })
        .strip(),
    )
    .mutation(async function ({
      input: { teamId, projectId, environmentId, serviceId, variables, type },
      ctx,
    }) {
      const { session, goClient } = ctx;
      if (!session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You need to be logged in to access this resource",
        });
      }
      const res = await goClient.variables.delete({
        team_id: teamId,
        project_id: projectId,
        environment_id: environmentId,
        service_id: serviceId,
        variables,
        type,
      });
      return {
        data: res.data,
      };
    }),
});
