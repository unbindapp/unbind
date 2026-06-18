import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";

import { queryKeys } from "@/lib/queries/query-keys";

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

export const dockerSearchQuery = (input: { search?: string }) =>
  queryOptions({
    queryKey: queryKeys.docker.search(input),
    queryFn: async () => {
      const query = input.search || "a";
      const res = await fetch(
        `${dockerHubApi}/v2/search/repositories/?page_size=50&query=${query}`,
      );
      const parsed = DockerSearchResultSchema.parse(await res.json());
      return { repositories: parsed.results };
    },
  });

export const dockerTagsQuery = (input: { repository: string; search?: string }) =>
  queryOptions({
    queryKey: queryKeys.docker.tags(input),
    queryFn: async () => {
      const { repository, search } = input;
      const [namespace, name] = repository.includes("/")
        ? repository.split("/", 2)
        : ["library", repository];

      let endpoint = `${dockerHubApi}/v2/repositories/${namespace}/${name}/tags/?page_size=50`;
      if (search) endpoint += `&name=${encodeURIComponent(search)}`;

      const parsed = DockerTagsResultSchema.parse(await (await fetch(endpoint)).json());
      return { tags: parsed.results };
    },
  });
