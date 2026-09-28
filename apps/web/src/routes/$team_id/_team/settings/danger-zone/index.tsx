import { createFileRoute } from "@tanstack/react-router";

import { ComingSoonCard } from "@/components/coming-soon";
import SettingsTabTitle from "@/components/settings/settings-tab-title";

export const Route = createFileRoute("/$team_id/_team/settings/danger-zone/")({
  component: TeamDangerZoneSettings,
});

function TeamDangerZoneSettings() {
  return (
    <>
      <SettingsTabTitle>Delete Team</SettingsTabTitle>
      <ComingSoonCard className="mt-3" />
    </>
  );
}
