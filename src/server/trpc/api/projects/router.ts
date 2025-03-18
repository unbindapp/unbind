import { generateProjectName } from "@/server/trpc/api/projects/helpers";
import { createTRPCRouter, publicProcedure } from "@/server/trpc/setup/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

export const projectsRouter = createTRPCRouter({
  list: publicProcedure
    .input(
      z.object({
        teamId: z.string(),
      }),
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
      z.object({
        teamId: z.string(),
        displayName: z.string().optional(),
        description: z.string().optional(),
      }),
    )
    .mutation(async function ({ input: { teamId, displayName, description }, ctx }) {
      const { session, goClient } = ctx;
      if (!session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You need to be logged in to access this resource",
        });
      }
      const defaultDisplayName = generateProjectName();
      const defaultDescription = "A new project";

      const res = await goClient.projects.create({
        team_id: teamId,
        display_name: displayName || defaultDisplayName,
        description: description || defaultDescription,
      });
      return {
        data: res.data || [],
      };
    }),
  delete: publicProcedure
    .input(
      z.object({
        teamId: z.string(),
        projectId: z.string(),
      }),
    )
    .query(async function ({ input: { teamId, projectId }, ctx }) {
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
