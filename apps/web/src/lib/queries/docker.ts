import { queryOptions } from "@tanstack/react-query";

import { getGoClient } from "@/lib/server/client";

export const queryKeyDocker = {
  search: (input: { search?: string }) => ["docker", "search", input.search ?? null] as const,
  tags: (input: { repository: string; search?: string }) =>
    ["docker", "tags", input.repository, input.search ?? null] as const,
};

// Docker Hub is proxied through the Go API: hub.docker.com sends no CORS headers,
// so the SPA can't read it directly from the browser.
export const dockerSearchQuery = (input: { search?: string }) =>
  queryOptions({
    queryKey: queryKeyDocker.search(input),
    queryFn: async () => {
      const res = await getGoClient().docker.search({ query: input.search });
      return { repositories: res.data };
    },
  });

export const dockerTagsQuery = (input: { repository: string; search?: string }) =>
  queryOptions({
    queryKey: queryKeyDocker.tags(input),
    queryFn: async () => {
      const res = await getGoClient().docker.tags({
        repository: input.repository,
        search: input.search,
      });
      return { tags: res.data };
    },
  });
