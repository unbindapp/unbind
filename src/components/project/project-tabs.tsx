"use client";

import TabIndicator from "@/components/navigation/tab-indicator";
import { LinkButton } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { useIdsFromPathname } from "@/lib/hooks/use-ids-from-pathname";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type TTab = {
  title: string;
  href: string;
  looseMatch?: boolean;
};

export default function ProjectTabs({
  className,
  classNameInner,
  classNameButton,
  layoutId,
}: {
  className?: string;
  classNameInner?: string;
  classNameButton?: string;
  layoutId: string;
}) {
  const { teamId, projectId, environmentId } = useIdsFromPathname();
  const tabs: TTab[] = useMemo(() => {
    const baseTabUrl = `/${teamId}/project/${projectId}/environment/${environmentId}`;
    return [
      {
        title: "Services",
        href: baseTabUrl,
      },
      {
        title: "Logs",
        href: `${baseTabUrl}/logs`,
      },
      {
        title: "Metrics",
        href: `${baseTabUrl}/metrics`,
      },
      {
        title: "Settings",
        href: `${baseTabUrl}/settings`,
        looseMatch: true,
      },
    ];
  }, [teamId, projectId, environmentId]);

  const pathname = usePathname();
  const [activeTabPath, setActiveTabPath] = useState<string | undefined>(pathname);

  useEffect(() => {
    setActiveTabPath(pathname);
  }, [pathname]);

  return (
    <div className={cn("flex min-w-0 flex-1 items-stretch overflow-hidden", className)}>
      <div className="flex min-w-0 flex-1 items-stretch overflow-auto">
        <div className={cn("flex items-stretch justify-start px-0 sm:px-3", classNameInner)}>
          {tabs.map((tab) => (
            <LinkButton
              data-active={isActive(tab, activeTabPath) ? true : undefined}
              key={tab.href}
              className={cn(
                `text-muted-foreground group/button data-active:text-foreground rounded px-3 py-4.25 text-sm leading-none font-medium focus-visible:ring-0 focus-visible:ring-offset-0 active:bg-transparent has-hover:hover:bg-transparent sm:py-4`,
                classNameButton,
              )}
              variant="ghost"
              href={tab.href || ""}
              onClick={() => setActiveTabPath(tab.href)}
            >
              {isActive(tab, activeTabPath) && (
                <TabIndicator
                  layoutId={layoutId}
                  className="top-0 bottom-auto sm:top-auto sm:bottom-0"
                />
              )}
              <div className="pointer-events-none absolute top-0 left-0 h-full w-full py-1.5">
                <div className="bg-border/0 has-hover:group-hover/button:bg-border group-active/button:bg-border group-focus-visible/button:ring-primary/50 h-full w-full rounded-lg group-focus-visible/button:ring-1" />
              </div>
              <p className="relative leading-none">{tab.title}</p>
            </LinkButton>
          ))}
        </div>
      </div>
    </div>
  );
}

function isActive(tab: TTab, activePath: string | undefined) {
  return activePath
    ? tab.href === activePath || (tab.looseMatch && activePath.startsWith(tab.href))
    : false;
}
