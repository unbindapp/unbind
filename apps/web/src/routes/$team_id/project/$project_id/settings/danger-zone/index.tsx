import { createFileRoute } from "@tanstack/react-router";

import DeleteProjectSection from "@/components/project/settings/delete-project-section";
import SettingsTabTitle from "@/components/settings/settings-tab-title";

export const Route = createFileRoute("/$team_id/project/$project_id/settings/danger-zone/")({
  component: ProjectDangerZoneSettings,
});

function ProjectDangerZoneSettings() {
  return (
    <>
      <SettingsTabTitle className="text-destructive">Delete Project</SettingsTabTitle>
      <DeleteProjectSection className="mt-3" />
    </>
  );
}
