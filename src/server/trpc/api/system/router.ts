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
    .input(z.object({ domain: z.string().nonempty() }).strip())
    .query(async function ({ ctx: { goClient }, input: { domain } }) {
      const result = await goClient.system.dns.check({ domain });
      return {
        data: result.data,
      };
    }),
  checkForUpdates: privateProcedure.query(async function ({ ctx: { goClient } }) {
    const result = await goClient.system.update.check();
    return {
      data: result,
    };
  }),
  checkUpdateStatus: privateProcedure
    .input(z.object({ expected_version: z.string() }))
    .query(async function ({ ctx: { goClient }, input: { expected_version } }) {
      const result = await goClient.system.update.status({ expected_version });
      return {
        data: result,
      };
    }),
  applyUpdate: privateProcedure
    .input(z.object({ target_version: z.string() }))
    .query(async function ({ ctx: { goClient }, input: { target_version } }) {
      const result = await goClient.system.update.apply({ target_version });
      return {
        data: result,
      };
    }),
});
