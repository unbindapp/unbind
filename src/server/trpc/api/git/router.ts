import { createTRPCRouter, publicProcedure } from "@/server/trpc/setup/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

export const gitRouter = createTRPCRouter({
  listRepositories: publicProcedure.input(z.object({})).query(async function ({ input: {}, ctx }) {
    const { session, goClient } = ctx;
    if (!session) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Unauthorized",
      });
    }
    const { data } = await goClient.github.repositories();
    return {
      repositories: data || [],
    };
  }),
  getRepository: publicProcedure
    .input(
      z.object({
        installationId: z.number(),
        owner: z.string(),
        repoName: z.string(),
      }),
    )
    .query(async function ({ input: { installationId, owner, repoName }, ctx }) {
      const { session, goClient } = ctx;
      if (!session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You need to be logged in to access this resource",
        });
      }
      const service = await goClient.github.repositories.info({
        installation_id: installationId,
        repo_name: repoName,
        owner,
      });
      return {
        repository: service.data,
      };
    }),
});
