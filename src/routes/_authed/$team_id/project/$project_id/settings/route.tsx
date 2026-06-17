import { createFileRoute, Outlet } from "@tanstack/react-router";

import SettingsLayout from "@/components/settings/settings-layout";
import { TSettingsTab } from "@/components/settings/settings-tabs";

export const Route = createFileRoute("/_authed/$team_id/project/$project_id/settings")({
  component: ProjectSettingsLayout,
});

function ProjectSettingsLayout() {
  const { team_id: teamId, project_id: projectId } = Route.useParams();
  const basePath = `/${teamId}/project/${projectId}/settings`;

  const tabs: TSettingsTab[] = [
    { label: "General", href: basePath, icon: "general", strictMatch: true },
    { label: "Environments", href: `${basePath}/environments`, icon: "environments" },
    { label: "Project Variables", href: `${basePath}/variables`, icon: "variables" },
    { label: "Members", href: `${basePath}/members`, icon: "members" },
    { label: "Webhooks", href: `${basePath}/webhooks`, icon: "webhooks" },
    { label: "Danger Zone", href: `${basePath}/danger-zone`, icon: "danger-zone" },
  ];

  return (
    <SettingsLayout tabs={tabs}>
      <Outlet />
    </SettingsLayout>
  );
}
