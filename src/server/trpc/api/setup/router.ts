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
      const is_first_user_created = statusResult.data.is_first_user_created;
      if (is_first_user_created) {
        return {
          error: {
            code: "INITIAL_USER_ALREADY_EXISTS",
            message: "Initial user already exists.",
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
  status: publicProcedure.query(async function ({ ctx: { goClient } }) {
    const result = await goClient.setup.status();
    return {
      data: result.data,
    };
  }),
});
