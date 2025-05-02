"use client";

import { AppRouterOutputs, AppRouterQueryResult } from "@/server/trpc/api/root";
import { api } from "@/server/trpc/setup/client";
import { createContext, ReactNode, useContext, useMemo } from "react";

type TS3SourcesOutput = AppRouterOutputs["storage"]["s3"]["list"];

type TS3SourcesContext = {
  query: AppRouterQueryResult<TS3SourcesOutput>;
  teamId: string;
};

const S3SourcesContext = createContext<TS3SourcesContext | null>(null);

export const S3SourcesProvider: React.FC<{
  teamId: string;
  initialData?: TS3SourcesOutput;
  children: ReactNode;
}> = ({ teamId, initialData, children }) => {
  const query = api.storage.s3.list.useQuery({ teamId }, { initialData });
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
  const utils = api.useUtils();
  return {
    invalidate: () => utils.storage.s3.list.invalidate({ teamId }),
  };
};
