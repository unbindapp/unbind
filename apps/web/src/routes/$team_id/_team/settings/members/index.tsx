import { createFileRoute } from "@tanstack/react-router";

import MembersTabContent from "@/components/team/settings/members/members-tab-content";
import { teamMembersQuery } from "@/lib/queries/teams";

export const Route = createFileRoute("/$team_id/_team/settings/members/")({
  loader: ({ context: { queryClient }, params }) => {
    void queryClient.prefetchQuery(teamMembersQuery({ teamId: params.team_id }));
  },
  component: TeamMembersSettings,
});

function TeamMembersSettings() {
  return <MembersTabContent />;
}
