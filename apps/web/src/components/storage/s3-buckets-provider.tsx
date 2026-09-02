"use client";

import { queryKeyStorage, s3BucketsListQuery, type TS3BucketShallow } from "@/lib/queries/storage";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { createContext, ReactNode, useContext, useMemo } from "react";

export type TS3BucketsResult = { buckets: TS3BucketShallow[] };

type TS3BucketsContext = {
  query: UseQueryResult<TS3BucketsResult, Error>;
  teamId: string;
};

const S3BucketsContext = createContext<TS3BucketsContext | null>(null);

export const S3BucketsProvider: React.FC<{
  teamId: string;
  initialData?: TS3BucketsResult;
  children: ReactNode;
}> = ({ teamId, initialData, children }) => {
  const query = useQuery({ ...s3BucketsListQuery({ teamId }), initialData });
  const value = useMemo(() => ({ query, teamId }), [query, teamId]);

  return <S3BucketsContext.Provider value={value}>{children}</S3BucketsContext.Provider>;
};

export const useS3Buckets = () => {
  const context = useContext(S3BucketsContext);
  if (!context) {
    throw new Error("useS3Buckets must be used within an S3BucketsProvider");
  }
  return context;
};

export default S3BucketsProvider;

export const useS3BucketsUtils = ({ teamId }: { teamId: string }) => {
  const queryClient = useQueryClient();
  return {
    invalidate: () =>
      queryClient.invalidateQueries({ queryKey: queryKeyStorage.s3List({ teamId }) }),
  };
};
