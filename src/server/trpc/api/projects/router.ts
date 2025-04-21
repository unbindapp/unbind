import { generateProjectName } from "@/server/trpc/api/projects/helpers";
import { ProjectUpdateFormSchema } from "@/server/trpc/api/projects/types";
import { createTRPCRouter, publicProcedure } from "@/server/trpc/setup/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

export const projectsRouter = createTRPCRouter({
  get: publicProcedure
    .input(
      z
        .object({
          teamId: z.string().uuid(),
          projectId: z.string().uuid(),
        })
        .strip(),
    )
    .query(async function ({ input: { teamId, projectId }, ctx }) {
      const { session, goClient } = ctx;
      if (!session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You need to be logged in to access this resource",
        });
      }
      const res = await goClient.projects.get({ team_id: teamId, project_id: projectId });
      return {
        project: res.data,
      };
    }),
  list: publicProcedure
    .input(
      z
        .object({
          teamId: z.string().uuid(),
        })
        .strip(),
    )
    .query(async function ({ input: { teamId }, ctx }) {
      const { session, goClient } = ctx;
      if (!session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You need to be logged in to access this resource",
        });
      }
      const res = await goClient.projects.list({ team_id: teamId });
      return {
        projects: res.data || [],
      };
    }),
  create: publicProcedure
    .input(
      z
        .object({
          teamId: z.string().uuid(),
          name: z.string().optional(),
          description: z.string().optional(),
        })
        .strip(),
    )
    .mutation(async function ({ input: { teamId, name, description }, ctx }) {
      const { session, goClient } = ctx;
      if (!session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You need to be logged in to access this resource",
        });
      }
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
  update: publicProcedure
    .input(
      z
        .object({
          teamId: z.string().uuid(),
          projectId: z.string().uuid(),
        })
        .strip()
        .merge(ProjectUpdateFormSchema),
    )
    .mutation(async function ({ input: { name, description, teamId, projectId }, ctx }) {
      const { session, goClient } = ctx;
      if (!session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You need to be logged in to access this resource",
        });
      }

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
  delete: publicProcedure
    .input(
      z
        .object({
          teamId: z.string().uuid(),
          projectId: z.string().uuid(),
        })
        .strip(),
    )
    .mutation(async function ({ input: { teamId, projectId }, ctx }) {
      const { session, goClient } = ctx;
      if (!session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You need to be logged in to access this resource",
        });
      }
      const res = await goClient.projects.delete({ team_id: teamId, project_id: projectId });
      return {
        data: res.data,
      };
    }),
});
