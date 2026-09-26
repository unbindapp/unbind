"use client";

import {
  gitAppsQuery,
  queryKeyGit,
  queryKeyGitApps,
  type TGitApp,
  type TGitAppsFilter,
} from "@/lib/queries/git";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { createContext, ReactNode, useContext, useMemo } from "react";

export type TGithubAppsResult = { apps: TGitApp[] };

type TGithubAppsContext = {
  query: UseQueryResult<TGithubAppsResult, Error>;
  filter: TGitAppsFilter;
};

const GithubAppsContext = createContext<TGithubAppsContext | null>(null);

export const GithubAppsProvider: React.FC<{
  filter: TGitAppsFilter;
  initialData?: TGithubAppsResult;
  children: ReactNode;
}> = ({ filter, initialData, children }) => {
  const query = useQuery({ ...gitAppsQuery(filter), initialData });
  const value = useMemo(() => ({ query, filter }), [query, filter]);
  return <GithubAppsContext.Provider value={value}>{children}</GithubAppsContext.Provider>;
};

export const useGithubApps = () => {
  const context = useContext(GithubAppsContext);
  if (!context) {
    throw new Error("useGithubApps must be used within a GithubAppsProvider");
  }
  return context;
};

// A change to a connection changes which repositories every picker can offer
export const useGithubAppsUtils = () => {
  const queryClient = useQueryClient();
  return {
    invalidate: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeyGitApps.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeyGit.repositories() }),
      ]);
    },
  };
};

export default GithubAppsProvider;
