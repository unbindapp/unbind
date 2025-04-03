import { TeamUpdateFormSchema } from "@/server/trpc/api/teams/types";
import { createTRPCRouter, publicProcedure } from "@/server/trpc/setup/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

export const teamsRouter = createTRPCRouter({
  get: publicProcedure
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
      const res = await goClient.teams.list();
      const team = res.data.find((team) => team.id === teamId);
      if (!team) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Team not found",
        });
      }
      return {
        team,
      };
    }),
  list: publicProcedure.query(async function ({ ctx }) {
    const { session, goClient } = ctx;
    if (!session) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "You need to be logged in to access this resource",
      });
    }
    const res = await goClient.teams.list();
    return {
      teams: res.data || [],
    };
  }),
  update: publicProcedure
    .input(
      z
        .object({
          teamId: z.string().uuid(),
        })
        .strip()
        .merge(TeamUpdateFormSchema),
    )
    .mutation(async function ({ input: { displayName, description, teamId }, ctx }) {
      const { session, goClient } = ctx;
      if (!session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You need to be logged in to access this resource",
        });
      }

      const res = await goClient.teams.update({
        team_id: teamId,
        display_name: displayName,
        description,
      });

      return {
        data: res.data,
      };
    }),
});
