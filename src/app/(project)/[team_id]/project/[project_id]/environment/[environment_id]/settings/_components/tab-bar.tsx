"use client";

import TabIndicator from "@/components/navigation/tab-indicator";
import { LinkButton } from "@/components/ui/button";
import { useIdsFromPathname } from "@/lib/hooks/use-ids-from-pathname";
import {
  KeyRoundIcon,
  SlidersHorizontalIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { FC, useEffect, useMemo, useState } from "react";

type TTab = {
  label: string;
  href: string;
  Icon: FC<{ className?: string; style?: { transform?: string } }>;
  looseMatch?: boolean;
};

export default function TabBar() {
  const { teamId, projectId, environmentId } = useIdsFromPathname();
  const pathname = usePathname();
  const [activeTabPath, setActiveTabPath] = useState<string | undefined>(
    pathname
  );

  const tabs = useMemo<TTab[]>(() => {
    const basePath = `/${teamId}/project/${projectId}/environment/${environmentId}/settings`;
    return [
      {
        label: "General",
        href: `${basePath}`,
        Icon: SlidersHorizontalIcon,
      },
      {
        label: "Shared Variables",
        href: `${basePath}/shared-variables`,
        Icon: KeyRoundIcon,
      },
      {
        label: "Danger Zone",
        href: `${basePath}/danger-zone`,
        Icon: TriangleAlertIcon,
      },
    ];
  }, [teamId, projectId, environmentId]);

  useEffect(() => {
    setActiveTabPath(pathname);
  }, [pathname]);

  return (
    <div
      className="md:max-h-[calc(100svh-6rem)] lg:max-h-[calc(100svh-3rem-1px)] w-full md:w-52 flex max-h-full bg-background 
      border-b md:border-0 flex-row items-center md:items-start md:flex-col md:justify-start overflow-auto 
      sticky top-0 left-0 sm:top-[calc(5.75rem+2px)] lg:top-[calc(3rem-1px)] sm:px-3 md:p-1 z-50"
    >
      {tabs.map((tab) => (
        <LinkButton
          forceMinSize={false}
          key={tab.href}
          data-active={isActive(tab, activeTabPath) ? true : undefined}
          onClick={() => setActiveTabPath(tab.href)}
          href={tab.href}
          variant="ghost"
          className="md:w-full shrink-0 text-muted-foreground data-active:text-foreground text-left justify-start font-medium 
          px-3 py-4.25 sm:py-4 md:px-4 md:py-3.25 text-sm md:text-base rounded-lg gap-1.5 md:gap-2.5 group/button
          has-hover:hover:bg-transparent active:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
        >
          <div className="w-full h-full absolute left-0 top-0 py-1.5 md:py-0">
            <div
              className="w-full h-full rounded-lg has-hover:group-hover/button:bg-border group-active/button:bg-border
              group-focus-visible/button:ring-1 group-focus-visible/button:ring-offset-2 group-focus-visible/button:ring-offset-background group-focus-visible/button:ring-primary/50"
            />
          </div>
          {isActive(tab, activeTabPath) && (
            <TabIndicator
              layoutId="sidebar-tab-indicator"
              className="md:top-2 md:h-[calc(100%-1rem)] md:w-0.5"
            />
          )}
          <tab.Icon className="size-4 md:size-5 shrink-0 -ml-0.25 md:-ml-1 -my-1 relative translate-z-0" />
          <p className="whitespace-nowrap md:shrink md:min-w-0 md:whitespace-normal relative leading-none">
            {tab.label}
          </p>
        </LinkButton>
      ))}
    </div>
  );
}

function isActive(tab: TTab, activePath: string | undefined) {
  return activePath
    ? tab.href === activePath ||
        (tab.looseMatch && activePath.startsWith(tab.href))
    : false;
}
