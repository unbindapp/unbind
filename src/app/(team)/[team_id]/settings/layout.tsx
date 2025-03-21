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
  const { teamId } = useIdsFromPathname();

  const tabs = useMemo<TSettingsTab[]>(() => {
    const basePath = `/${teamId}/settings`;
    const t: TSettingsTab[] = [
      {
        label: "General",
        href: `${basePath}`,
        Icon: SlidersHorizontalIcon,
        strictMatch: true,
        searchParamStr: "",
      },
      {
        label: "Shared Variables",
        href: `${basePath}/shared-variables`,
        Icon: KeyRoundIcon,
        searchParamStr: "",
      },
      {
        label: "Members",
        href: `${basePath}/members`,
        Icon: UsersIcon,
        searchParamStr: "",
      },
      {
        label: "Notifications",
        href: `${basePath}/notifications`,
        Icon: BellIcon,
        searchParamStr: "",
      },
      {
        label: "Webhooks",
        href: `${basePath}/webhooks`,
        Icon: WebhookIcon,
        searchParamStr: "",
      },
      {
        label: "Danger Zone",
        href: `${basePath}/danger-zone`,
        Icon: TriangleAlertIcon,
        searchParamStr: "",
      },
    ];
    return t;
  }, [teamId]);

  return <SettingsLayout tabs={tabs}>{children}</SettingsLayout>;
}
