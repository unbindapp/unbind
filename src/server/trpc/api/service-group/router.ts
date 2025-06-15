import { ServiceDescriptionSchema, ServiceNameSchema } from "@/server/trpc/api/services/types";
import { createTRPCRouter, privateProcedure } from "@/server/trpc/setup/trpc";
import { z } from "zod";

export const serviceGroupsRouter = createTRPCRouter({
  update: privateProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        teamId: z.string().uuid(),
        projectId: z.string().uuid(),
        environmentId: z.string().uuid(),
        name: ServiceNameSchema,
        description: ServiceDescriptionSchema,
      }),
    )
    .mutation(async function ({
      input: { id, teamId, projectId, environmentId, name, description },
      ctx: { goClient },
    }) {
      const result = await goClient.service_groups.update({
        id,
        team_id: teamId,
        environment_id: environmentId,
        project_id: projectId,
        name,
        description,
      });
      return {
        serviceGroup: result.data,
      };
    }),
  delete: privateProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        teamId: z.string().uuid(),
        projectId: z.string().uuid(),
        environmentId: z.string().uuid(),
        deleteServices: z.boolean(),
      }),
    )
    .mutation(async function ({
      input: { id, teamId, projectId, environmentId, deleteServices },
      ctx: { goClient },
    }) {
      const result = await goClient.service_groups.delete({
        id,
        team_id: teamId,
        environment_id: environmentId,
        project_id: projectId,
        delete_services: deleteServices,
      });
      return {
        data: result.data,
      };
    }),
});
