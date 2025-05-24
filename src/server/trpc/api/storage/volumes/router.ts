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
  resize: privateProcedure
    .input(
      z
        .object({
          id: z.string(),
          type: PvcScopeSchema,
          sizeGb: z.string(),
          teamId: z.string().uuid(),
          projectId: z.string().uuid(),
          environmentId: z.string().uuid(),
        })
        .strip(),
    )
    .mutation(async function ({
      input: { id, type, sizeGb, teamId, projectId, environmentId },
      ctx: { goClient },
    }) {
      const res = await goClient.storage.pvc.update({
        id,
        type,
        size: sizeGb,
        team_id: teamId,
        project_id: projectId,
        environment_id: environmentId,
      });
      return {
        volume: res.data,
      };
    }),
});
