import { createFileRoute, linkOptions, Outlet } from "@tanstack/react-router";

import SettingsLayout from "@/components/settings/settings-layout";
import { TSettingsTab } from "@/components/settings/settings-tabs";

export const Route = createFileRoute("/$team_id/project/$project_id/settings")({
  component: ProjectSettingsLayout,
});

function ProjectSettingsLayout() {
  const { team_id: teamId, project_id: projectId } = Route.useParams();
  const basePath = `/${teamId}/project/${projectId}/settings`;
  const params = { team_id: teamId, project_id: projectId };

  const tabs: TSettingsTab[] = [
    {
      label: "General",
      icon: "general",
      strictMatch: true,
      matchPath: basePath,
      link: linkOptions({ to: "/$team_id/project/$project_id/settings", params }),
    },
    {
      label: "Environments",
      icon: "environments",
      matchPath: `${basePath}/environments`,
      link: linkOptions({ to: "/$team_id/project/$project_id/settings/environments", params }),
    },
    {
      label: "Project Variables",
      icon: "variables",
      matchPath: `${basePath}/variables`,
      link: linkOptions({ to: "/$team_id/project/$project_id/settings/variables", params }),
      classNameChildrenWrapper: "gap-0",
    },
    {
      label: "Members",
      icon: "members",
      matchPath: `${basePath}/members`,
      link: linkOptions({ to: "/$team_id/project/$project_id/settings/members", params }),
    },
    {
      label: "Webhooks",
      icon: "webhooks",
      matchPath: `${basePath}/webhooks`,
      link: linkOptions({ to: "/$team_id/project/$project_id/settings/webhooks", params }),
    },
    {
      label: "Danger Zone",
      icon: "danger-zone",
      matchPath: `${basePath}/danger-zone`,
      link: linkOptions({ to: "/$team_id/project/$project_id/settings/danger-zone", params }),
    },
  ];

  return (
    <SettingsLayout title="Project Settings" tabs={tabs}>
      <Outlet />
    </SettingsLayout>
  );
}
