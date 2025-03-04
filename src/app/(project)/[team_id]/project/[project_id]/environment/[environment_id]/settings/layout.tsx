"use client";

import SettingsLayout from "@/components/settings/settings-layout";
import { TSettingsTab } from "@/components/settings/settings-tab-bar";
import { useIdsFromPathname } from "@/lib/hooks/use-ids-from-pathname";
import {
  BellIcon,
  KeyRoundIcon,
  SlidersHorizontalIcon,
  TriangleAlertIcon,
  UsersIcon,
  WebhookIcon,
} from "lucide-react";
import { ReactNode, useMemo } from "react";

export default function Layout({ children }: { children: ReactNode }) {
  const { teamId, projectId, environmentId } = useIdsFromPathname();

  const tabs = useMemo<TSettingsTab[]>(() => {
    const basePath = `/${teamId}/project/${projectId}/environment/${environmentId}/settings`;
    const t: TSettingsTab[] = [
      {
        label: "General",
        href: `${basePath}`,
        Icon: SlidersHorizontalIcon,
        strictMatch: true,
      },
      {
        label: "Shared Variables",
        href: `${basePath}/shared-variables`,
        Icon: KeyRoundIcon,
      },
      {
        label: "Members",
        href: `${basePath}/members`,
        Icon: UsersIcon,
      },
      {
        label: "Notifications",
        href: `${basePath}/notifications`,
        Icon: BellIcon,
      },
      {
        label: "Webhooks",
        href: `${basePath}/webhooks`,
        Icon: WebhookIcon,
      },
      {
        label: "Danger Zone",
        href: `${basePath}/danger-zone`,
        Icon: TriangleAlertIcon,
      },
    ];
    return t;
  }, [teamId, projectId, environmentId]);

  return <SettingsLayout tabs={tabs}>{children}</SettingsLayout>;
}
