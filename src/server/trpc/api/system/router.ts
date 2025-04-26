import { createTRPCRouter, privateProcedure } from "@/server/trpc/setup/trpc";
import { z } from "zod";

export const systemRouter = createTRPCRouter({
  get: privateProcedure.input(z.object({}).strip()).query(async function ({ ctx: { goClient } }) {
    const result = await goClient.system.get();
    return {
      data: result.data,
    };
  }),
});
