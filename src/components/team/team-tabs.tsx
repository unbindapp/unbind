"use client";

import TabIndicator from "@/components/navigation/tab-indicator";
import { LinkButton } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { useIdsFromPathname } from "@/lib/hooks/use-ids-from-pathname";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type TTab = {
  title: string;
  href?: string;
};

const getBaseTabUrl = ({ teamId }: { teamId?: string }) =>
  teamId ? `/${teamId}` : undefined;

export default function TeamTabs({
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
  const { teamId } = useIdsFromPathname();
  const tabs: TTab[] = useMemo(() => {
    return [
      {
        title: "Projects",
        href: getBaseTabUrl({ teamId }),
      },
      {
        title: "Settings",
        href: `${getBaseTabUrl({ teamId })}/settings`,
      },
    ];
  }, [teamId]);

  const pathname = usePathname();
  const [activeTabPath, setActiveTabPath] = useState<string | undefined>(
    pathname
  );

  useEffect(() => {
    setActiveTabPath(pathname);
  }, [pathname]);

  return (
    <div
      className={cn(
        "flex-1 flex items-stretch min-w-0 overflow-hidden",
        className
      )}
    >
      <div className="flex-1 flex items-stretch min-w-0 overflow-auto">
        <div
          className={cn(
            "px-0 sm:px-3 flex justify-start items-stretch",
            classNameInner
          )}
        >
          {tabs.map((tab) => (
            <LinkButton
              data-active={tab.href === activeTabPath ? true : undefined}
              key={tab.href}
              className={cn(
                `font-medium text-sm px-3 py-4.25 sm:py-4 rounded leading-none text-muted-foreground 
                  has-hover:hover:bg-transparent active:bg-transparent group/button data-active:text-foreground
                  focus-visible:ring-0 focus-visible:ring-offset-0`,
                classNameButton
              )}
              variant="ghost"
              href={tab.href || ""}
              onClick={() => setActiveTabPath(tab.href)}
            >
              {activeTabPath === tab.href && (
                <TabIndicator
                  layoutId={layoutId}
                  className="top-0 bottom-auto sm:bottom-0 sm:top-auto"
                />
              )}
              <div className="absolute left-0 top-0 w-full h-full pointer-events-none py-1.5">
                <div
                  className="w-full h-full rounded-lg bg-border/0 has-hover:group-hover/button:bg-border group-active/button:bg-border
                  group-focus-visible/button:ring-1 group-focus-visible/button:ring-primary/50"
                />
              </div>

              <p className="relative">{tab.title}</p>
            </LinkButton>
          ))}
        </div>
      </div>
    </div>
  );
}
