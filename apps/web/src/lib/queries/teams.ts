import { queryOptions } from "@tanstack/react-query";

import { getGoClient } from "@/server/client";
import { queryKeys } from "@/lib/queries/query-keys";
import type { TeamResponse } from "@/server/client.gen";

export type TTeam = TeamResponse;

// Mirrors the old teams tRPC router: same input + the `res.data` → `{ teams }` reshape.
export const teamsListQuery = () =>
  queryOptions({
    queryKey: queryKeys.teams.list(),
    queryFn: async () => {
      const res = await getGoClient().teams.list();
      return { teams: res.data };
    },
  });

export const teamQuery = (teamId: string) =>
  queryOptions({
    queryKey: queryKeys.teams.detail(teamId),
    queryFn: async () => {
      const res = await getGoClient().teams.get({ team_id: teamId });
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
