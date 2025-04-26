import { generateProjectName } from "@/server/trpc/api/projects/helpers";
import { ProjectUpdateFormSchema } from "@/server/trpc/api/projects/types";
import { createTRPCRouter, privateProcedure } from "@/server/trpc/setup/trpc";
import { z } from "zod";

export const projectsRouter = createTRPCRouter({
  get: privateProcedure
    .input(
      z
        .object({
          teamId: z.string().uuid(),
          projectId: z.string().uuid(),
        })
        .strip(),
    )
    .query(async function ({ input: { teamId, projectId }, ctx: { goClient } }) {
      const res = await goClient.projects.get({ team_id: teamId, project_id: projectId });
      return {
        project: res.data,
      };
    }),
  list: privateProcedure
    .input(
      z
        .object({
          teamId: z.string().uuid(),
        })
        .strip(),
    )
    .query(async function ({ input: { teamId }, ctx: { goClient } }) {
      const res = await goClient.projects.list({ team_id: teamId });

      return {
        projects: res.data,
      };
    }),
  create: privateProcedure
    .input(
      z
        .object({
          teamId: z.string().uuid(),
          name: z.string().optional(),
          description: z.string().optional(),
        })
        .strip(),
    )
    .mutation(async function ({ input: { teamId, name, description }, ctx: { goClient } }) {
      const defaultname = generateProjectName();

      const res = await goClient.projects.create({
        team_id: teamId,
        name: name || defaultname,
        description,
      });
      return {
        data: res.data,
      };
    }),
  update: privateProcedure
    .input(
      z
        .object({
          teamId: z.string().uuid(),
          projectId: z.string().uuid(),
        })
        .strip()
        .merge(ProjectUpdateFormSchema),
    )
    .mutation(async function ({
      input: { name, description, teamId, projectId },
      ctx: { goClient },
    }) {
      const res = await goClient.projects.update({
        team_id: teamId,
        project_id: projectId,
        name: name,
        description,
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
          projectId: z.string().uuid(),
        })
        .strip(),
    )
    .mutation(async function ({ input: { teamId, projectId }, ctx: { goClient } }) {
      const res = await goClient.projects.delete({ team_id: teamId, project_id: projectId });
      return {
        data: res.data,
      };
    }),
});
