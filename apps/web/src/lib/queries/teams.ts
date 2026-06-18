import { queryOptions } from "@tanstack/react-query";

import { getGoClient } from "@/server/client";
import type { TeamResponse } from "@/server/client.gen";

export type TTeam = TeamResponse;

export const queryKeyTeams = {
  list: () => ["teams", "list"] as const,
  detail: (input: { teamId: string }) => ["teams", "detail", input.teamId] as const,
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

export async function updateTeam(input: { teamId: string; name: string; description: string }) {
  const res = await getGoClient().teams.update({
    team_id: input.teamId,
    name: input.name,
    description: input.description,
  });
  return { data: res.data };
}
