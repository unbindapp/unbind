import { createFileRoute } from "@tanstack/react-router";

import { ProjectMembersTabContent } from "@/components/team/settings/members/members-tab-content";
import { teamMembersQuery } from "@/lib/queries/teams";

export const Route = createFileRoute("/$team_id/project/$project_id/settings/members/")({
  loader: ({ context: { queryClient }, params }) => {
    void queryClient.prefetchQuery(
      teamMembersQuery({ teamId: params.team_id, projectId: params.project_id }),
    );
  },
  component: ProjectMembersSettings,
});

function ProjectMembersSettings() {
  return <ProjectMembersTabContent />;
}
