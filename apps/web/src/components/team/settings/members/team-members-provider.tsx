"use client";

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
  projectId?: string;
  scopeNoun: "team" | "project";
  canManage: boolean;
  members: UseQueryResult<{ members: TTeamMember[] }, Error>;
  invitations: UseQueryResult<{ invitations: TTeamInvitation[] }, Error>;
};

const TeamMembersContext = createContext<TContext | null>(null);

type TProps = {
  teamId: string;
  projectId?: string;
  canManage: boolean;
  children: ReactNode;
};

export function TeamMembersProvider({ teamId, projectId, canManage, children }: TProps) {
  const members = useQuery(teamMembersQuery({ teamId, projectId }));
  const invitations = useQuery({
    ...teamInvitationsQuery({ teamId, projectId }),
    enabled: canManage,
  });

  const value = useMemo(
    () => ({
      teamId,
      projectId,
      scopeNoun: projectId ? ("project" as const) : ("team" as const),
      canManage,
      members,
      invitations,
    }),
    [teamId, projectId, canManage, members, invitations],
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
  const { teamId, projectId } = useTeamMembers();
  return {
    invalidate: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeyTeams.members({ teamId, projectId }) }),
        queryClient.invalidateQueries({
          queryKey: queryKeyTeams.invitations({ teamId, projectId }),
        }),
      ]),
  };
}
