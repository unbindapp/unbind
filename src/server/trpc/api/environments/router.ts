import { createTRPCRouter, publicProcedure } from "@/server/trpc/setup/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

export const environmentsRouter = createTRPCRouter({
  list: publicProcedure
    .input(
      z.object({
        teamId: z.string(),
        projectId: z.string(),
      }),
    )
    .query(async function ({ input: { teamId, projectId }, ctx }) {
      const { session } = ctx;
      console.log(teamId, projectId);
      if (!session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You need to be logged in to access this resource",
        });
      }
      return {
        environments: [
          {
            id: "a2f1a442-052a-4451-a604-223049d89eab",
            display_name: "production",
          },
        ],
      };
    }),
});
