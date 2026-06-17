"use client";

import { teamQuery, type TTeam } from "@/api/services/teams";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { createContext, ReactNode, useContext, useMemo } from "react";

export type TTeamResult = { team: TTeam };

type TTeamContext = {
  query: UseQueryResult<TTeamResult, Error>;
  teamId: string;
};

const TeamContext = createContext<TTeamContext | null>(null);

export const TeamProvider: React.FC<{
  teamId: string;
  initialData?: TTeamResult;
  children: ReactNode;
}> = ({ teamId, initialData, children }) => {
  const query = useQuery({ ...teamQuery(teamId), initialData });
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
