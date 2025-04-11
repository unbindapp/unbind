"use client";

import { AppRouterOutputs, AppRouterQueryResult } from "@/server/trpc/api/root";
import { api } from "@/server/trpc/setup/client";
import { createContext, ReactNode, useContext, useMemo } from "react";

type TEnvironmentsContext = {
  query: AppRouterQueryResult<AppRouterOutputs["environments"]["list"]>;
  utils: ReturnType<typeof useEnvironmentsUtils>;
  teamId: string;
  projectId: string;
};

const EnvironmentsContext = createContext<TEnvironmentsContext | null>(null);

export const EnvironmentsProvider: React.FC<{
  teamId: string;
  projectId: string;
  initialData?: AppRouterOutputs["environments"]["list"];
  children: ReactNode;
}> = ({ teamId, projectId, initialData, children }) => {
  const query = api.environments.list.useQuery({ teamId, projectId }, { initialData });
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
  const utils = api.useUtils();
  return {
    invalidate: () => utils.environments.list.invalidate({ teamId, projectId }),
  };
};
