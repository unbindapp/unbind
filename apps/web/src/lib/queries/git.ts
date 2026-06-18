import { queryOptions } from "@tanstack/react-query";

import { getGoClient } from "@/server/client";
import type { GithubAdminRepositoryListResponseBody } from "@/server/client.gen";

export type TGitRepository = GithubAdminRepositoryListResponseBody["data"][number];

export const queryKeyGit = {
  repositories: () => ["git", "repositories"] as const,
  app: (input: { uuid: string }) => ["git", "app", input.uuid] as const,
  repository: (input: { installationId: number; owner: string; repoName: string }) =>
    ["git", "repository", input.installationId, input.owner, input.repoName] as const,
};

export const gitRepositoriesQuery = () =>
  queryOptions({
    queryKey: queryKeyGit.repositories(),
    queryFn: async () => {
      const { data } = await getGoClient().github.repositories();
      return { repositories: data };
    },
  });

export const gitAppQuery = (input: { uuid: string }) =>
  queryOptions({
    queryKey: queryKeyGit.app(input),
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
    queryKey: queryKeyGit.repository(input),
    queryFn: async () => {
      const res = await getGoClient().github.repositories.info({
        installation_id: input.installationId,
        repo_name: input.repoName,
        owner: input.owner,
      });
      return { repository: res.data };
    },
  });
