import { createTRPCRouter, privateProcedure } from "@/server/trpc/setup/trpc";
import { z } from "zod";

export const gitRouter = createTRPCRouter({
  listRepositories: privateProcedure.input(z.object({}).strip()).query(async function ({
    input: {},
    ctx: { goClient },
  }) {
    const { data } = await goClient.github.repositories();
    return {
      repositories: data || [],
    };
  }),
  getRepository: privateProcedure
    .input(
      z
        .object({
          installationId: z.number(),
          owner: z.string(),
          repoName: z.string(),
        })
        .strip(),
    )
    .query(async function ({ input: { installationId, owner, repoName }, ctx: { goClient } }) {
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
