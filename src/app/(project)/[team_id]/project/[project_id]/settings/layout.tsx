"use client";

import SettingsLayout from "@/components/settings/settings-layout";
import { TSettingsTab } from "@/components/settings/settings-tabs";
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
    const basePath = `/${teamId}/project/${projectId}/settings`;
    const environment = `?environment=${environmentId}`;
    const t: TSettingsTab[] = [
      {
        label: "General",
        href: `${basePath}`,
        Icon: SlidersHorizontalIcon,
        strictMatch: true,
        searchParamStr: environment,
      },
      {
        label: "Shared Variables",
        href: `${basePath}/shared-variables`,
        Icon: KeyRoundIcon,
        searchParamStr: environment,
      },
      {
        label: "Members",
        href: `${basePath}/members`,
        Icon: UsersIcon,
        searchParamStr: environment,
      },
      {
        label: "Notifications",
        href: `${basePath}/notifications`,
        Icon: BellIcon,
        searchParamStr: environment,
      },
      {
        label: "Webhooks",
        href: `${basePath}/webhooks`,
        Icon: WebhookIcon,
        searchParamStr: environment,
      },
      {
        label: "Danger Zone",
        href: `${basePath}/danger-zone`,
        Icon: TriangleAlertIcon,
        searchParamStr: environment,
      },
    ];
    return t;
  }, [teamId, projectId, environmentId]);

  return <SettingsLayout tabs={tabs}>{children}</SettingsLayout>;
}
