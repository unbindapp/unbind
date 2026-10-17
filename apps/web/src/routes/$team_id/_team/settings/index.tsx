import { createFileRoute } from "@tanstack/react-router";

import SettingsTabTitle from "@/components/settings/settings-tab-title";
import GeneralTabContent from "@/components/team/settings/general-tab-content";

export const Route = createFileRoute("/$team_id/_team/settings/")({
  component: TeamGeneralSettings,
});

function TeamGeneralSettings() {
  const { team_id: teamId } = Route.useParams();
  return (
    <>
      <SettingsTabTitle>General</SettingsTabTitle>
      <GeneralTabContent className="mt-3" teamId={teamId} />
    </>
  );
}
