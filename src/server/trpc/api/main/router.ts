import { createTRPCRouter, publicProcedure } from "@/server/trpc/setup/trpc";
import { z } from "zod";

export const mainRouter = createTRPCRouter({
  getUniversities: publicProcedure
    .input(
      z.object({
        name: z.string(),
      })
    )
    .query(async function ({ input: { name } }) {
      return {
        data: `Hello ${name}`,
      };
    }),
});
