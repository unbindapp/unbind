"use client";

import { queryKeys } from "@/lib/queries/query-keys";
import { s3SourcesListQuery, type TS3SourceShallow } from "@/lib/queries/storage";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { createContext, ReactNode, useContext, useMemo } from "react";

export type TS3SourcesResult = { sources: TS3SourceShallow[] };

type TS3SourcesContext = {
  query: UseQueryResult<TS3SourcesResult, Error>;
  teamId: string;
};

const S3SourcesContext = createContext<TS3SourcesContext | null>(null);

export const S3SourcesProvider: React.FC<{
  teamId: string;
  initialData?: TS3SourcesResult;
  children: ReactNode;
}> = ({ teamId, initialData, children }) => {
  const query = useQuery({ ...s3SourcesListQuery(teamId), initialData });
  const value = useMemo(() => ({ query, teamId }), [query, teamId]);

  return <S3SourcesContext.Provider value={value}>{children}</S3SourcesContext.Provider>;
};

export const useS3Sources = () => {
  const context = useContext(S3SourcesContext);
  if (!context) {
    throw new Error("useS3Sources must be used within an S3SourcesProvider");
  }
  return context;
};

export default S3SourcesProvider;

export const useS3SourcesUtils = ({ teamId }: { teamId: string }) => {
  const queryClient = useQueryClient();
  return {
    invalidate: () => queryClient.invalidateQueries({ queryKey: queryKeys.storage.s3List(teamId) }),
  };
};
