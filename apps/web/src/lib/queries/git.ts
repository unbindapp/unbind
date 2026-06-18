import { queryOptions } from "@tanstack/react-query";

import { getGoClient } from "@/server/client";
import { queryKeys } from "@/lib/queries/query-keys";
import type { GithubAdminRepositoryListResponseBody } from "@/server/client.gen";

export type TGitRepository = GithubAdminRepositoryListResponseBody["data"][number];

export const gitRepositoriesQuery = () =>
  queryOptions({
    queryKey: queryKeys.git.repositories(),
    queryFn: async () => {
      const { data } = await getGoClient().github.repositories();
      return { repositories: data };
    },
  });

export const gitAppQuery = (input: { uuid: string }) =>
  queryOptions({
    queryKey: queryKeys.git.app(input),
    queryFn: async () => {
      const { data } = await getGoClient().github.app.get({ uuid: input.uuid });
      return { app: data };
    },
  });

export const gitRepositoryQuery = (input: {
  installationId: number;
  owner: string;
  repoName: string;
}) =>
  queryOptions({
    queryKey: queryKeys.git.repository(input),
    queryFn: async () => {
      const res = await getGoClient().github.repositories.info({
        installation_id: input.installationId,
        repo_name: input.repoName,
        owner: input.owner,
      });
      return { repository: res.data };
    },
  });
