import { createFileRoute, Outlet } from "@tanstack/react-router";

import SettingsLayout from "@/components/settings/settings-layout";
import { TSettingsTab } from "@/components/settings/settings-tabs";

export const Route = createFileRoute("/_authed/$team_id/_team/settings")({
  component: TeamSettingsLayout,
});

function TeamSettingsLayout() {
  const { team_id: teamId } = Route.useParams();
  const basePath = `/${teamId}/settings`;

  const tabs: TSettingsTab[] = [
    { label: "General", href: basePath, icon: "general", strictMatch: true },
    { label: "Team Variables", href: `${basePath}/variables`, icon: "variables" },
    { label: "Storage", href: `${basePath}/storage`, icon: "storage" },
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
