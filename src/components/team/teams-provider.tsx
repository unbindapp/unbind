"use client";

import { AppRouterOutputs, AppRouterQueryResult } from "@/server/trpc/api/root";
import { api } from "@/server/trpc/setup/client";
import { createContext, ReactNode, useContext } from "react";

type TTeamsContext = AppRouterQueryResult<AppRouterOutputs["teams"]["list"]>;

const TeamsContext = createContext<TTeamsContext | null>(null);

export const TeamsProvider: React.FC<{
  initialData: AppRouterOutputs["teams"]["list"];
  children: ReactNode;
}> = ({ initialData, children }) => {
  const query = api.teams.list.useQuery(undefined, { initialData });

  return <TeamsContext.Provider value={query}>{children}</TeamsContext.Provider>;
};

export const useTeams = () => {
  const context = useContext(TeamsContext);
  if (!context) {
    throw new Error("useTeams must be used within an TeamsProvider");
  }
  return context;
};

export default TeamsProvider;
