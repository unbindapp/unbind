import { createFileRoute, linkOptions, Outlet } from "@tanstack/react-router";

import SettingsLayout from "@/components/settings/settings-layout";
import { TSettingsTab } from "@/components/settings/settings-tabs";

const basePath = "/system/settings";

const tabs: TSettingsTab[] = [
  {
    label: "General",
    icon: "general",
    strictMatch: true,
    matchPath: basePath,
    link: linkOptions({ to: "/system/settings" }),
  },
];

export const Route = createFileRoute("/system/settings")({
  component: SystemSettingsLayout,
});

function SystemSettingsLayout() {
  return (
    <SettingsLayout title="System Settings" tabs={tabs}>
      <Outlet />
    </SettingsLayout>
  );
}
