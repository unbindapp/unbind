import { TeamUpdateFormSchema } from "@/server/trpc/api/teams/types";
import { createTRPCRouter, privateProcedure } from "@/server/trpc/setup/trpc";
import { z } from "zod";

export const teamsRouter = createTRPCRouter({
  get: privateProcedure
    .input(
      z
        .object({
          teamId: z.string().uuid(),
        })
        .strip(),
    )
    .query(async function ({ input: { teamId }, ctx: { goClient } }) {
      const res = await goClient.teams.get({ team_id: teamId });
      return {
        team: res.data,
      };
    }),
  list: privateProcedure.query(async function ({ ctx: { goClient } }) {
    const res = await goClient.teams.list();
    return {
      teams: res.data || [],
    };
  }),
  update: privateProcedure
    .input(
      z
        .object({
          teamId: z.string().uuid(),
        })
        .strip()
        .merge(TeamUpdateFormSchema),
    )
    .mutation(async function ({ input: { name, description, teamId }, ctx: { goClient } }) {
      const res = await goClient.teams.update({
        team_id: teamId,
        name: name,
        description,
      });

      return {
        data: res.data,
      };
    }),
});
