import { createFileRoute } from "@tanstack/react-router";

import { ComingSoonCard } from "@/components/coming-soon";
import SettingsTabTitle from "@/components/settings/settings-tab-title";

export const Route = createFileRoute("/$team_id/_team/settings/members/")({
  component: TeamMembersSettings,
});

function TeamMembersSettings() {
  return (
    <>
      <SettingsTabTitle>Members</SettingsTabTitle>
      <div className="-mx-1 mt-2 w-[calc(100%+0.5rem)] p-1 md:max-w-3xl">
        <ComingSoonCard />
      </div>
    </>
  );
}
