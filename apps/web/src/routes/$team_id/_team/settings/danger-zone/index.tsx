import { createFileRoute } from "@tanstack/react-router";

import NoItemsCard from "@/components/no-items-card";
import SettingsTabTitle from "@/components/settings/settings-tab-title";
import DeleteTeamSection from "@/components/team/settings/delete-team-section";
import { useTeam } from "@/components/team/team-provider";
import { LockIcon } from "lucide-react";

export const Route = createFileRoute("/$team_id/_team/settings/danger-zone/")({
  component: TeamDangerZoneSettings,
});

function TeamDangerZoneSettings() {
  const {
    query: { data },
  } = useTeam();
  const canDelete = data?.team.permissions.includes("admin") ?? false;

  return (
    <>
      <SettingsTabTitle className="text-destructive">Delete Team</SettingsTabTitle>
      {canDelete ? (
        <DeleteTeamSection className="mt-3" />
      ) : (
        <NoItemsCard Icon={LockIcon} className="mt-3">
          Only team admins can delete the team
        </NoItemsCard>
      )}
    </>
  );
}
