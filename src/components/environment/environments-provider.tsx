"use client";

import { queryKeys } from "@/api/query-keys";
import { environmentsListQuery, type TEnvironmentShallow } from "@/api/queries/environments";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { createContext, ReactNode, useContext, useMemo } from "react";

export type TEnvironmentsResult = { environments: TEnvironmentShallow[] };

type TEnvironmentsContext = {
  query: UseQueryResult<TEnvironmentsResult, Error>;
  utils: ReturnType<typeof useEnvironmentsUtils>;
  teamId: string;
  projectId: string;
};

const EnvironmentsContext = createContext<TEnvironmentsContext | null>(null);

export const EnvironmentsProvider: React.FC<{
  teamId: string;
  projectId: string;
  initialData?: TEnvironmentsResult;
  children: ReactNode;
}> = ({ teamId, projectId, initialData, children }) => {
  const query = useQuery({ ...environmentsListQuery(teamId, projectId), initialData });
  const utils = useEnvironmentsUtils({ teamId, projectId });
  const value = useMemo(
    () => ({ query, utils, teamId, projectId }),
    [query, utils, teamId, projectId],
  );

  return <EnvironmentsContext.Provider value={value}>{children}</EnvironmentsContext.Provider>;
};

export const useEnvironments = () => {
  const context = useContext(EnvironmentsContext);
  if (!context) {
    throw new Error("useEnvironments must be used within an EnvironmentsProvider");
  }
  return context;
};

export default EnvironmentsProvider;

export const useEnvironmentsUtils = ({
  teamId,
  projectId,
}: {
  teamId: string;
  projectId: string;
}) => {
  const queryClient = useQueryClient();
  return {
    invalidate: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.environments.list(teamId, projectId) }),
  };
};
