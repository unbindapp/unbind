"use client";

import { AppRouterOutputs, AppRouterQueryResult } from "@/server/trpc/api/root";
import { api } from "@/server/trpc/setup/client";
import { createContext, ReactNode, useContext, useMemo } from "react";

type TTeamContext = {
  query: AppRouterQueryResult<AppRouterOutputs["teams"]["get"]>;
  teamId: string;
};

const TeamContext = createContext<TTeamContext | null>(null);

export const TeamProvider: React.FC<{
  teamId: string;
  initialData?: AppRouterOutputs["teams"]["get"];
  children: ReactNode;
}> = ({ teamId, initialData, children }) => {
  const query = api.teams.get.useQuery({ teamId }, { initialData });
  const value = useMemo(() => ({ query, teamId }), [query, teamId]);

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
};

export const useTeam = () => {
  const context = useContext(TeamContext);
  if (!context) {
    throw new Error("useTeam must be used within an TeamProvider");
  }
  return context;
};

export default TeamProvider;
