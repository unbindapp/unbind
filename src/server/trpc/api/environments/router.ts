import { CreateEnvironmentFormNameSchema } from "@/server/trpc/api/environments/types";
import { createTRPCRouter, privateProcedure } from "@/server/trpc/setup/trpc";
import { z } from "zod";

export const environmentsRouter = createTRPCRouter({
  get: privateProcedure
    .input(
      z
        .object({
          id: z.string().uuid(),
          teamId: z.string().uuid(),
          projectId: z.string().uuid(),
        })
        .strip(),
    )
    .query(async function ({ input: { id, teamId, projectId }, ctx: { goClient } }) {
      const res = await goClient.environments.get({ id, team_id: teamId, project_id: projectId });
      return {
        environment: res.data,
      };
    }),
  list: privateProcedure
    .input(
      z
        .object({
          teamId: z.string().uuid(),
          projectId: z.string().uuid(),
        })
        .strip(),
    )
    .query(async function ({ input: { teamId, projectId }, ctx: { goClient } }) {
      const res = await goClient.environments.list({ team_id: teamId, project_id: projectId });
      return {
        environments: res.data,
      };
    }),
  create: privateProcedure
    .input(
      z
        .object({
          teamId: z.string().uuid(),
          projectId: z.string().uuid(),
          name: CreateEnvironmentFormNameSchema,
          description: z.string().optional(),
        })
        .strip(),
    )
    .mutation(async function ({
      input: { teamId, projectId, name, description },
      ctx: { goClient },
    }) {
      const res = await goClient.environments.create({
        team_id: teamId,
        project_id: projectId,
        name: name,
        description: description || null,
      });
      return {
        data: res.data,
      };
    }),
  update: privateProcedure
    .input(
      z
        .object({
          id: z.string().uuid(),
          teamId: z.string().uuid(),
          projectId: z.string().uuid(),
          name: z.string().optional(),
          description: z.string().optional(),
        })
        .strip(),
    )
    .mutation(async function ({
      input: { id, name, description, teamId, projectId },
      ctx: { goClient },
    }) {
      const res = await goClient.environments.update({
        team_id: teamId,
        project_id: projectId,
        environment_id: id,
        name: name || null,
        description: description || null,
      });

      return {
        data: res.data,
      };
    }),
  delete: privateProcedure
    .input(
      z
        .object({
          id: z.string().uuid(),
          teamId: z.string().uuid(),
          projectId: z.string().uuid(),
        })
        .strip(),
    )
    .mutation(async function ({ input: { id, teamId, projectId }, ctx: { goClient } }) {
      const res = await goClient.environments.delete({
        environment_id: id,
        team_id: teamId,
        project_id: projectId,
      });
      return {
        data: res.data,
      };
    }),
});
