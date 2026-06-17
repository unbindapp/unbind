import { createFileRoute, linkOptions, Outlet } from "@tanstack/react-router";

import SettingsLayout from "@/components/settings/settings-layout";
import { TSettingsTab } from "@/components/settings/settings-tabs";

export const Route = createFileRoute("/_authed/$team_id/_team/settings")({
  component: TeamSettingsLayout,
});

function TeamSettingsLayout() {
  const { team_id: teamId } = Route.useParams();
  const basePath = `/${teamId}/settings`;
  const params = { team_id: teamId };

  const tabs: TSettingsTab[] = [
    {
      label: "General",
      icon: "general",
      strictMatch: true,
      matchPath: basePath,
      link: linkOptions({ to: "/$team_id/settings", params }),
    },
    {
      label: "Team Variables",
      icon: "variables",
      matchPath: `${basePath}/variables`,
      link: linkOptions({ to: "/$team_id/settings/variables", params }),
    },
    {
      label: "Storage",
      icon: "storage",
      matchPath: `${basePath}/storage`,
      link: linkOptions({ to: "/$team_id/settings/storage", params }),
    },
    {
      label: "Members",
      icon: "members",
      matchPath: `${basePath}/members`,
      link: linkOptions({ to: "/$team_id/settings/members", params }),
    },
    {
      label: "Webhooks",
      icon: "webhooks",
      matchPath: `${basePath}/webhooks`,
      link: linkOptions({ to: "/$team_id/settings/webhooks", params }),
    },
    {
      label: "Danger Zone",
      icon: "danger-zone",
      matchPath: `${basePath}/danger-zone`,
      link: linkOptions({ to: "/$team_id/settings/danger-zone", params }),
    },
  ];

  return (
    <SettingsLayout tabs={tabs}>
      <Outlet />
    </SettingsLayout>
  );
}
