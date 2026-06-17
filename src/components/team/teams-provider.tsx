"use client";

import { teamsListQuery, type TTeam } from "@/api/services/teams";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { createContext, ReactNode, useContext } from "react";

export type TTeamsResult = { teams: TTeam[] };
type TTeamsContext = UseQueryResult<TTeamsResult, Error>;

const TeamsContext = createContext<TTeamsContext | null>(null);

export const TeamsProvider: React.FC<{
  initialData?: TTeamsResult;
  children: ReactNode;
}> = ({ initialData, children }) => {
  const query = useQuery({ ...teamsListQuery(), initialData });

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
