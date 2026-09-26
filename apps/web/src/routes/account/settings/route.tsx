import { createFileRoute, linkOptions, Outlet } from "@tanstack/react-router";

import SettingsLayout from "@/components/settings/settings-layout";
import { TSettingsTab } from "@/components/settings/settings-tabs";

const basePath = "/account/settings";

const tabs: TSettingsTab[] = [
  {
    label: "General",
    icon: "general",
    strictMatch: true,
    matchPath: basePath,
    link: linkOptions({ to: "/account/settings" }),
  },
  {
    label: "API Keys",
    icon: "api-keys",
    matchPath: `${basePath}/api-keys`,
    link: linkOptions({ to: "/account/settings/api-keys" }),
  },
  {
    label: "Connected Apps",
    icon: "connected-apps",
    matchPath: `${basePath}/connected-apps`,
    link: linkOptions({ to: "/account/settings/connected-apps" }),
  },
  {
    label: "GitHub Apps",
    icon: "github",
    matchPath: `${basePath}/github`,
    link: linkOptions({ to: "/account/settings/github" }),
  },
];

export const Route = createFileRoute("/account/settings")({
  component: AccountSettingsLayout,
});

function AccountSettingsLayout() {
  return (
    <SettingsLayout title="Account Settings" tabs={tabs}>
      <Outlet />
    </SettingsLayout>
  );
}
