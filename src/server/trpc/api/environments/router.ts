import { CreateEnvironmentFormNameSchema } from "@/server/trpc/api/environments/types";
import { createTRPCRouter, publicProcedure } from "@/server/trpc/setup/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

export const environmentsRouter = createTRPCRouter({
  get: publicProcedure
    .input(
      z
        .object({
          id: z.string().uuid(),
          teamId: z.string().uuid(),
          projectId: z.string().uuid(),
        })
        .strip(),
    )
    .query(async function ({ input: { id, teamId, projectId }, ctx }) {
      const { session, goClient } = ctx;
      if (!session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You need to be logged in to access this resource",
        });
      }
      const res = await goClient.environments.get({ id, team_id: teamId, project_id: projectId });
      return {
        environment: res.data,
      };
    }),
  list: publicProcedure
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
      const res = await goClient.environments.list({ team_id: teamId, project_id: projectId });
      return {
        environments: res.data || [],
      };
    }),
  create: publicProcedure
    .input(
      z
        .object({
          teamId: z.string().uuid(),
          projectId: z.string().uuid(),
          displayName: CreateEnvironmentFormNameSchema,
          description: z.string().optional(),
        })
        .strip(),
    )
    .mutation(async function ({ input: { teamId, projectId, displayName, description }, ctx }) {
      const { session, goClient } = ctx;
      if (!session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You need to be logged in to access this resource",
        });
      }

      const res = await goClient.environments.create({
        team_id: teamId,
        project_id: projectId,
        display_name: displayName,
        description: description || null,
      });
      return {
        data: res.data,
      };
    }),
  update: publicProcedure
    .input(
      z
        .object({
          id: z.string().uuid(),
          teamId: z.string().uuid(),
          projectId: z.string().uuid(),
          displayName: z.string().optional(),
          description: z.string().optional(),
        })
        .strip(),
    )
    .mutation(async function ({ input: { id, displayName, description, teamId, projectId }, ctx }) {
      const { session, goClient } = ctx;
      if (!session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You need to be logged in to access this resource",
        });
      }

      const res = await goClient.environments.update({
        team_id: teamId,
        project_id: projectId,
        environment_id: id,
        name: displayName || null,
        description: description || null,
      });

      return {
        data: res.data,
      };
    }),
  delete: publicProcedure
    .input(
      z
        .object({
          id: z.string().uuid(),
          teamId: z.string().uuid(),
          projectId: z.string().uuid(),
        })
        .strip(),
    )
    .mutation(async function ({ input: { id, teamId, projectId }, ctx }) {
      const { session, goClient } = ctx;
      if (!session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You need to be logged in to access this resource",
        });
      }
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
