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

export const gitAppQuery = (uuid: string) =>
  queryOptions({
    queryKey: queryKeys.git.app(uuid),
    queryFn: async () => {
      const { data } = await getGoClient().github.app.get({ uuid });
      return { app: data };
    },
  });

export const gitRepositoryQuery = (installationId: number, owner: string, repoName: string) =>
  queryOptions({
    queryKey: queryKeys.git.repository(installationId, owner, repoName),
    queryFn: async () => {
      const res = await getGoClient().github.repositories.info({
        installation_id: installationId,
        repo_name: repoName,
        owner,
      });
      return { repository: res.data };
    },
  });
