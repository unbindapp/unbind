import {
  list_variablesQuerySchema,
  VariableReferenceSourceTypeSchema,
  VariableUpdateBehaviorSchema,
} from "@/server/go/client.gen";
import {
  VariableForCreateSchema,
  VariableReferenceForCreateSchema,
} from "@/server/trpc/api/variables/types";
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
        ...res.data,
      };
    }),
  createOrUpdate: publicProcedure
    .input(
      z
        .object({
          teamId: z.string().uuid(),
          projectId: z.string().uuid().optional(),
          environmentId: z.string().uuid().optional(),
          serviceId: z.string().uuid().optional(),
          variables: z.array(VariableForCreateSchema),
          variableReferences: z.array(VariableReferenceForCreateSchema).optional(),
          type: VariableReferenceSourceTypeSchema,
          behavior: VariableUpdateBehaviorSchema.default("upsert"),
        })
        .strip(),
    )
    .mutation(async function ({
      input: {
        teamId,
        projectId,
        environmentId,
        serviceId,
        variables,
        variableReferences,
        type,
        behavior,
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
      const res = await goClient.variables.update({
        behavior,
        team_id: teamId,
        project_id: projectId,
        environment_id: environmentId,
        service_id: serviceId,
        variables,
        variable_references: variableReferences,
        type,
      });
      return {
        data: res.data,
      };
    }),
  delete: publicProcedure
    .input(
      z
        .object({
          teamId: z.string().uuid(),
          projectId: z.string().uuid().optional(),
          environmentId: z.string().uuid().optional(),
          serviceId: z.string().uuid().optional(),
          variables: z.array(z.object({ name: z.string() }).strip()),
          variableReferenceIds: z.array(z.string().uuid()),
          type: VariableReferenceSourceTypeSchema,
        })
        .strip(),
    )
    .mutation(async function ({
      input: { teamId, projectId, environmentId, serviceId, variables, variableReferenceIds, type },
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
        variable_reference_ids: variableReferenceIds,
        type,
      });
      return {
        data: res.data,
      };
    }),
  listAvailableVariableReferences: publicProcedure
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
    .query(async function ({ input: { teamId, projectId, environmentId, serviceId }, ctx }) {
      const { session, goClient } = ctx;
      await new Promise((resolve) => setTimeout(resolve, 3000));
      if (!session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You need to be logged in to access this resource",
        });
      }
      const res = await goClient.variables.references.available({
        team_id: teamId,
        environment_id: environmentId,
        project_id: projectId,
        service_id: serviceId,
      });
      return {
        variables: res.data,
      };
    }),
});
