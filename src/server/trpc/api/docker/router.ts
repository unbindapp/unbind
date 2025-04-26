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

const DockerTagsResultSchema = z
  .object({
    results: z.array(
      z.object({
        name: z.string(),
        tag_last_pushed: z.string().optional(),
        full_size: z.number().optional(),
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
      const dockerHubSearchEndpoint = `${dockerHubApi}/v2/search/repositories/?page_size=50&query=${search}`;
      const res = await fetch(dockerHubSearchEndpoint);
      const resJson = await res.json();
      const resParsed = DockerSearchResultSchema.parse(resJson);
      return {
        repositories: resParsed.results,
      };
    }),
  listTags: privateProcedure
    .input(
      z
        .object({
          repository: z.string(),
          search: z.string().optional(),
        })
        .strip(),
    )
    .query(async function ({ input: { repository, search } }) {
      const [namespace, name] = repository.includes("/")
        ? repository.split("/", 2)
        : ["library", repository];

      let dockerHubTagsEndpoint = `${dockerHubApi}/v2/repositories/${namespace}/${name}/tags/?page_size=50`;
      if (search) {
        dockerHubTagsEndpoint += `&name=${encodeURIComponent(search)}`;
      }

      const res = await fetch(dockerHubTagsEndpoint);
      const resJson = await res.json();

      const resParsed = DockerTagsResultSchema.parse(resJson);
      return {
        tags: resParsed.results,
      };
    }),
});
