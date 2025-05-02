import SettingsLayout from "@/components/settings/settings-layout";
import { TSettingsTab } from "@/components/settings/settings-tabs";
import { ReactNode } from "react";

type TProps = {
  params: Promise<{
    team_id: string;
  }>;
  children: ReactNode;
};

export default async function Layout({ params, children }: TProps) {
  const { team_id: teamId } = await params;

  const basePath = `/${teamId}/settings`;
  const tabs: TSettingsTab[] = [
    {
      label: "General",
      href: `${basePath}`,
      icon: "general",
      strictMatch: true,
    },
    {
      label: "Team Variables",
      href: `${basePath}/variables`,
      icon: "variables",
    },
    {
      label: "Storage",
      href: `${basePath}/storage`,
      icon: "storage",
    },
    {
      label: "Members",
      href: `${basePath}/members`,
      icon: "members",
    },
    {
      label: "Webhooks",
      href: `${basePath}/webhooks`,
      icon: "webhooks",
    },
    {
      label: "Danger Zone",
      href: `${basePath}/danger-zone`,
      icon: "danger-zone",
    },
  ];

  return <SettingsLayout tabs={tabs}>{children}</SettingsLayout>;
}
