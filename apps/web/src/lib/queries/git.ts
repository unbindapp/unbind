import { queryOptions } from "@tanstack/react-query";

import { getGoClient } from "@/lib/server/client";
import type {
  GithubAppAPIResponse,
  GithubInstallationAPIResponse,
  GithubRepositoryListResponseBody,
} from "@/lib/server/client.gen";

export type TGitRepository = GithubRepositoryListResponseBody["data"][number];

export const queryKeyGit = {
  repositories: () => ["git", "repositories"] as const,
  app: (input: { uuid: string }) => ["git", "app", input.uuid] as const,
  repository: (input: { installationId: number; owner: string; repoName: string }) =>
    ["git", "repository", input.installationId, input.owner, input.repoName] as const,
  watchPathSuggestions: (input: {
    installationId: number;
    owner: string;
    repoName: string;
    ref: string;
  }) =>
    [
      "git",
      "watch-path-suggestions",
      input.installationId,
      input.owner,
      input.repoName,
      input.ref,
    ] as const,
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

export const gitWatchPathSuggestionsQuery = (input: {
  installationId: number;
  owner: string;
  repoName: string;
  ref: string;
}) =>
  queryOptions({
    queryKey: queryKeyGit.watchPathSuggestions(input),
    queryFn: async () => {
      const res = await getGoClient().github.repositories.watchPaths({
        installation_id: input.installationId,
        repo_name: input.repoName,
        owner: input.owner,
        ref: input.ref,
      });
      return res.data;
    },
  });

// ---- GitHub connections ----

export type TGitApp = GithubAppAPIResponse;
export type TGitInstallation = GithubInstallationAPIResponse;

export type TGitAppsFilter = { owned: true; teamId?: never } | { owned?: never; teamId: string };

export const queryKeyGitApps = {
  all: () => ["git", "apps"] as const,
  list: (filter: TGitAppsFilter) =>
    ["git", "apps", filter.owned ? "owned" : "team", filter.teamId ?? ""] as const,
};

export const gitAppsQuery = (filter: TGitAppsFilter) =>
  queryOptions({
    queryKey: queryKeyGitApps.list(filter),
    queryFn: async () => {
      const res = await getGoClient().github.apps({ owned: filter.owned, team_id: filter.teamId });
      return { apps: res.data };
    },
  });

export async function setGitAppTeam(input: { uuid: string; teamId: string | null }) {
  const res = await getGoClient().github.app.team({ uuid: input.uuid, team_id: input.teamId });
  return { app: res.data };
}

export async function deleteGitApp(input: { uuid: string }) {
  const res = await getGoClient().github.app.delete({ uuid: input.uuid });
  return { data: res.data };
}

export async function deleteGitInstallation(input: { installationId: number }) {
  const res = await getGoClient().github.installation.delete({
    installation_id: input.installationId,
  });
  return { data: res.data };
}

// The app is created on GitHub, so its name is the slug GitHub links use.
// With one installation GitHub sends the install page there anyway, so link straight to it.
export function gitAppAccessUrl(app: TGitApp) {
  if (app.installations.length === 1) return gitInstallationSettingsUrl(app.installations[0]);
  return `https://github.com/apps/${encodeURIComponent(app.name)}/installations/new`;
}

export function gitAppSettingsUrl(app: TGitApp) {
  if (app.owner_type === "Organization" && app.owner_login) {
    return `https://github.com/organizations/${encodeURIComponent(app.owner_login)}/settings/apps/${encodeURIComponent(app.name)}`;
  }
  return `https://github.com/settings/apps/${encodeURIComponent(app.name)}`;
}

export function gitInstallationSettingsUrl(installation: TGitInstallation) {
  if (installation.account_type === "Organization") {
    return `https://github.com/organizations/${encodeURIComponent(installation.account_login)}/settings/installations/${installation.id}`;
  }
  return `https://github.com/settings/installations/${installation.id}`;
}
