"use client";

import { AppRouterOutputs, AppRouterQueryResult } from "@/server/trpc/api/root";
import { api } from "@/server/trpc/setup/client";
import { createContext, ReactNode, useContext } from "react";

type TVariablesContext = AppRouterQueryResult<AppRouterOutputs["secrets"]["list"]>;

const VariablesContext = createContext<TVariablesContext | null>(null);

export const VariablesProvider: React.FC<{
  teamId: string;
  projectId: string;
  environmentId: string;
  serviceId: string;
  children: ReactNode;
}> = ({ teamId, projectId, environmentId, serviceId, children }) => {
  const query = api.secrets.list.useQuery({ teamId, projectId, environmentId, serviceId });

  return <VariablesContext.Provider value={query}>{children}</VariablesContext.Provider>;
};

export const useVariables = () => {
  const context = useContext(VariablesContext);
  if (!context) {
    throw new Error("useVariables must be used within an VariablesProvider");
  }
  return context;
};

export default VariablesProvider;

export const useVariablesUtils = ({ teamId }: { teamId: string }) => {
  const utils = api.useUtils();
  return {
    invalidate: () => utils.secrets.list.invalidate({ teamId }),
  };
};
