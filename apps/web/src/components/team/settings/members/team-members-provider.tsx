"use client";

import { useTeam } from "@/components/team/team-provider";
import {
  queryKeyTeams,
  teamInvitationsQuery,
  teamMembersQuery,
  type TTeamInvitation,
  type TTeamMember,
} from "@/lib/queries/teams";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { createContext, ReactNode, useContext, useMemo } from "react";

type TContext = {
  teamId: string;
  canManage: boolean;
  members: UseQueryResult<{ members: TTeamMember[] }, Error>;
  invitations: UseQueryResult<{ invitations: TTeamInvitation[] }, Error>;
};

const TeamMembersContext = createContext<TContext | null>(null);

export function TeamMembersProvider({ children }: { children: ReactNode }) {
  const {
    teamId,
    query: { data: teamData },
  } = useTeam();
  const canManage = teamData?.team.permissions.includes("admin") ?? false;
  const members = useQuery(teamMembersQuery({ teamId }));
  const invitations = useQuery({ ...teamInvitationsQuery({ teamId }), enabled: canManage });

  const value = useMemo(
    () => ({ teamId, canManage, members, invitations }),
    [teamId, canManage, members, invitations],
  );
  return <TeamMembersContext.Provider value={value}>{children}</TeamMembersContext.Provider>;
}

export function useTeamMembers() {
  const context = useContext(TeamMembersContext);
  if (!context) {
    throw new Error("useTeamMembers must be used within a TeamMembersProvider");
  }
  return context;
}

export function useTeamMembersUtils() {
  const queryClient = useQueryClient();
  const { teamId } = useTeam();
  return {
    invalidate: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeyTeams.members({ teamId }) }),
        queryClient.invalidateQueries({ queryKey: queryKeyTeams.invitations({ teamId }) }),
      ]),
  };
}
