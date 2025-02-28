"use client";

import TabIndicator from "@/components/navigation/tab-indicator";
import { LinkButton } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { useIdsFromPathname } from "@/lib/hooks/use-ids-from-pathname";
import {
  KeyRoundIcon,
  SlidersHorizontalIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { FC, useEffect, useMemo, useState } from "react";

type Props = {
  className?: string;
};

type TTab = {
  label: string;
  href: string;
  Icon: FC<{ className?: string }>;
  looseMatch?: boolean;
};

export default function Sidebar({ className }: Props) {
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
      className={cn(
        "w-full md:w-52 flex flex-row overflow-auto md:flex-col sticky top-0 left-0 border-b md:border-none",
        className
      )}
    >
      {tabs.map((tab) => (
        <LinkButton
          key={tab.href}
          data-active={isActive(tab, activeTabPath) ? true : undefined}
          onClick={() => setActiveTabPath(tab.href)}
          href={tab.href}
          variant="ghost"
          className="md:w-full text-muted-foreground data-[active]:text-foreground text-left justify-start font-medium 
          px-4 text-sm md:text-base rounded-lg gap-2.5 group/button"
        >
          {isActive(tab, activeTabPath) && (
            <TabIndicator
              layoutId={"sidebar-tab-indicator"}
              className=" md:top-2.5 md:left-0.5 md:h-[calc(100%-1.25rem)] md:w-0.5"
            />
          )}
          <tab.Icon className="size-4 md:size-5 shrink-0 -ml-1" />
          <p className="md:shrink md:min-w-0 leading-tight">{tab.label}</p>
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
