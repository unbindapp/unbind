import {
  list_variablesQuerySchema,
  VariableReferenceSourceTypeSchema,
  VariableUpdateBehaviorSchema,
} from "@/server/go/client.gen";
import {
  VariableForCreateSchema,
  VariableReferenceForCreateSchema,
} from "@/server/trpc/api/variables/types";
import { createTRPCRouter, privateProcedure } from "@/server/trpc/setup/trpc";
import { z } from "zod";

export const variablesRouter = createTRPCRouter({
  list: privateProcedure
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
    .query(async function ({
      input: { teamId, projectId, environmentId, serviceId, type },
      ctx: { goClient },
    }) {
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
  createOrUpdate: privateProcedure
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
      ctx: { goClient },
    }) {
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
  delete: privateProcedure
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
      ctx: { goClient },
    }) {
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
  listAvailableVariableReferences: privateProcedure
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
    .query(async function ({
      input: { teamId, projectId, environmentId, serviceId },
      ctx: { goClient },
    }) {
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
