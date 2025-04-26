import { createTRPCRouter, privateProcedure } from "@/server/trpc/setup/trpc";
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
  searchRepositories: privateProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
        })
        .strip(),
    )
    .query(async function ({ input: { search } }) {
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
