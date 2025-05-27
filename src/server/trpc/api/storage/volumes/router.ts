import { PvcScopeSchema } from "@/server/go/client.gen";
import { createTRPCRouter, privateProcedure } from "@/server/trpc/setup/trpc";
import { z } from "zod";

export const volumesRouter = createTRPCRouter({
  get: privateProcedure
    .input(
      z
        .object({
          id: z.string(),
          type: PvcScopeSchema,
          teamId: z.string().uuid(),
          projectId: z.string().uuid(),
          environmentId: z.string().uuid(),
        })
        .strip(),
    )
    .query(async function ({
      input: { id, type, teamId, projectId, environmentId },
      ctx: { goClient },
    }) {
      const res = await goClient.storage.pvc.get({
        id,
        type,
        team_id: teamId,
        project_id: projectId,
        environment_id: environmentId,
      });
      return {
        volume: res.data,
      };
    }),
  delete: privateProcedure
    .input(
      z
        .object({
          id: z.string(),
          type: PvcScopeSchema,
          teamId: z.string().uuid(),
          projectId: z.string().uuid(),
          environmentId: z.string().uuid(),
        })
        .strip(),
    )
    .mutation(async function ({
      input: { id, type, teamId, projectId, environmentId },
      ctx: { goClient },
    }) {
      const res = await goClient.storage.pvc.delete({
        id,
        type,
        team_id: teamId,
        project_id: projectId,
        environment_id: environmentId,
      });
      return {
        data: res.data,
      };
    }),
  expand: privateProcedure
    .input(
      z
        .object({
          id: z.string(),
          type: PvcScopeSchema,
          capacityGb: z.number(),
          teamId: z.string().uuid(),
          projectId: z.string().uuid(),
          environmentId: z.string().uuid(),
        })
        .strip(),
    )
    .mutation(async function ({
      input: { id, type, capacityGb, teamId, projectId, environmentId },
      ctx: { goClient },
    }) {
      const res = await goClient.storage.pvc.update({
        id,
        type,
        capacity_gb: capacityGb,
        team_id: teamId,
        project_id: projectId,
        environment_id: environmentId,
      });
      return {
        volume: res.data,
      };
    }),
});
