import { createTRPCRouter, privateProcedure } from "@/server/trpc/setup/trpc";
import { z } from "zod";

export const systemRouter = createTRPCRouter({
  get: privateProcedure.query(async function ({ ctx: { goClient } }) {
    const result = await goClient.system.get();
    return {
      data: result.data,
    };
  }),
  dnsCheck: privateProcedure
    .input(z.object({ domain: z.string().nonempty() }).strict())
    .query(async function ({ ctx: { goClient }, input: { domain } }) {
      const result = await goClient.system.dns.check({ domain });
      return {
        data: result.data,
      };
    }),
});
