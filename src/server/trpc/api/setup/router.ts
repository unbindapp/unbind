import { createTRPCRouter, publicProcedure } from "@/server/trpc/setup/trpc";
import { z } from "zod";

export const setupRouter = createTRPCRouter({
  createUser: publicProcedure
    .input(
      z
        .object({
          email: z.string().email(),
          password: z.string().min(8),
        })
        .strip(),
    )
    .mutation(async function ({ input: { email, password }, ctx: { goClient } }) {
      const statusResult = await goClient.setup.status();
      if (!statusResult.data.is_setup) {
        return {
          error: {
            code: "SETUP_ALREADY_COMPLETED",
            message: "Setup is already completed.",
          },
        };
      }

      const result = await goClient.setup.createUser({
        email,
        password,
      });

      return {
        data: result.data,
      };
    }),
  status: publicProcedure.input(z.object({}).strict()).query(async function ({
    ctx: { goClient },
  }) {
    const result = await goClient.setup.status();
    return {
      data: result.data,
    };
  }),
});
