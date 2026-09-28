import { createFileRoute } from "@tanstack/react-router";

import { ComingSoonCard } from "@/components/coming-soon";
import SettingsTabTitle from "@/components/settings/settings-tab-title";

export const Route = createFileRoute("/$team_id/project/$project_id/settings/members/")({
  component: ProjectMembersSettings,
});

function ProjectMembersSettings() {
  return (
    <>
      <SettingsTabTitle>Project Members</SettingsTabTitle>
      <ComingSoonCard className="mt-3" />
    </>
  );
}
