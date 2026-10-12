import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";

import { getGoClient } from "@/lib/server/client";
import type {
  InvitationResponse,
  PermittedAction,
  TeamMemberResponse,
  TeamResponse,
} from "@/lib/server/client.gen";

export const queryKeyTeams = {
  list: () => ["teams", "list"] as const,
  detail: (input: { teamId: string }) => ["teams", "detail", input.teamId] as const,
  members: (input: { teamId: string }) => ["teams", "members", input.teamId] as const,
  invitations: (input: { teamId: string }) => ["teams", "invitations", input.teamId] as const,
};

// Mirrors the old teams tRPC router: same input + the `res.data` → `{ teams }` reshape.
export const teamsListQuery = () =>
  queryOptions({
    queryKey: queryKeyTeams.list(),
    queryFn: async () => {
      const res = await getGoClient().teams.list();
      return { teams: res.data };
    },
  });

export const teamQuery = (input: { teamId: string }) =>
  queryOptions({
    queryKey: queryKeyTeams.detail(input),
    queryFn: async () => {
      const res = await getGoClient().teams.get({ team_id: input.teamId });
      return { team: res.data };
    },
  });

export const teamMembersQuery = (input: { teamId: string }) =>
  queryOptions({
    queryKey: queryKeyTeams.members(input),
    queryFn: async () => {
      const res = await getGoClient().teams.members({ team_id: input.teamId });
      return { members: res.data };
    },
  });

export const teamInvitationsQuery = (input: { teamId: string }) =>
  queryOptions({
    queryKey: queryKeyTeams.invitations(input),
    queryFn: async () => {
      const res = await getGoClient().teams.invitations({ team_id: input.teamId });
      return { invitations: res.data };
    },
  });

export async function createTeam(input: { name: string; description: string }) {
  const res = await getGoClient().teams.create({
    name: input.name,
    description: input.description || null,
  });
  return { data: res.data };
}

export async function deleteTeam(input: { teamId: string }) {
  const res = await getGoClient().teams.delete({ team_id: input.teamId });
  return { data: res.data };
}

export async function inviteTeamMember(input: {
  teamId: string;
  email: string;
  role: PermittedAction;
}) {
  const res = await getGoClient().teams.members.invite({
    team_id: input.teamId,
    email: input.email,
    role: input.role,
  });
  return { data: res.data };
}

export async function updateTeamMemberRole(input: {
  teamId: string;
  userId: string;
  role: PermittedAction;
}) {
  const res = await getGoClient().teams.members.update({
    team_id: input.teamId,
    user_id: input.userId,
    role: input.role,
  });
  return { data: res.data };
}

export async function removeTeamMember(input: { teamId: string; userId: string }) {
  const res = await getGoClient().teams.members.remove({
    team_id: input.teamId,
    user_id: input.userId,
  });
  return { data: res.data };
}

export async function revokeTeamInvitation(input: { teamId: string; invitationId: string }) {
  const res = await getGoClient().teams.invitations.revoke({
    team_id: input.teamId,
    invitation_id: input.invitationId,
  });
  return { data: res.data };
}

export async function updateTeam(input: { teamId: string; name: string; description: string }) {
  const res = await getGoClient().teams.update({
    team_id: input.teamId,
    name: input.name,
    description: input.description,
  });
  return { data: res.data };
}

// ---- Types ----

export type TTeam = TeamResponse;
export type TTeamMember = TeamMemberResponse;
export type TTeamInvitation = InvitationResponse;

export const teamNameMaxLength = 32;
export const teamDescriptionMaxLength = 128;

export const TeamUpdateFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Name is required.")
      .max(teamNameMaxLength, `Name should be at most ${teamNameMaxLength} characters.`),
    description: z
      .string()
      .max(
        teamDescriptionMaxLength,
        `Description should be at most ${teamDescriptionMaxLength} characters.`,
      ),
  })
  .strip();
