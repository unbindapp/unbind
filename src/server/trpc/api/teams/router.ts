import { createTRPCRouter, publicProcedure } from "@/server/trpc/setup/trpc";
import { TRPCError } from "@trpc/server";

export const teamsRouter = createTRPCRouter({
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
});
