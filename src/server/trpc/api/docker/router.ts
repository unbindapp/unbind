import { createTRPCRouter, publicProcedure } from "@/server/trpc/setup/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

const dockerHubApi = "https://hub.docker.com";

const DockerSearchResultSchema = z
  .object({
    results: z.array(
      z.object({
        repo_name: z.string(),
        pull_count: z.number(),
      }),
    ),
  })
  .strip();

export const dockerRouter = createTRPCRouter({
  searchRepositories: publicProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
        })
        .strip(),
    )
    .query(async function ({ input: { search }, ctx }) {
      const { session } = ctx;
      if (!session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Unauthorized",
        });
      }
      if (!search) search = "a";
      const dockerHubSearchEndpoint = `${dockerHubApi}/v2/search/repositories/?page_size=25&query=${search}`;
      const res = await fetch(dockerHubSearchEndpoint);
      const resJson = await res.json();
      const resParsed = DockerSearchResultSchema.parse(resJson);
      return {
        repositories: resParsed.results,
      };
    }),
});
