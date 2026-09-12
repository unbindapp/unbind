"use client";

import TabIndicator from "@/components/navigation/tab-indicator";
import { LinkButton } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";

type TTab = {
  title: string;
  to: "/system" | "/system/update" | "/system/settings";
  strictMatch?: boolean;
};

const tabs: TTab[] = [
  { title: "Servers", to: "/system", strictMatch: true },
  { title: "Update", to: "/system/update" },
  { title: "Settings", to: "/system/settings" },
];

export default function SystemTabs({
  className,
  classNameButton,
  layoutId,
}: {
  className?: string;
  classNameButton?: string;
  layoutId: string;
}) {
  const pathname = useLocation({ select: (l) => l.pathname });
  const [activeTabPath, setActiveTabPath] = useState<string | undefined>(pathname);

  useEffect(() => {
    setActiveTabPath(pathname);
  }, [pathname]);

  return (
    <div className={cn("flex items-stretch justify-start px-0 sm:px-3 lg:px-0", className)}>
      {tabs.map((tab) => (
        <LinkButton
          data-active={isActive(tab, activeTabPath) || undefined}
          key={tab.title}
          className={cn(
            `text-muted-foreground group/button data-active:text-foreground max-w-36 rounded px-3 py-3.5 text-sm leading-none font-medium focus-visible:ring-0 focus-visible:ring-offset-0 active:bg-transparent has-hover:hover:bg-transparent`,
            classNameButton,
          )}
          variant="ghost"
          to={tab.to}
          onClick={() => setActiveTabPath(tab.to)}
        >
          {isActive(tab, activeTabPath) && (
            <TabIndicator
              layoutId={layoutId}
              className="top-0 bottom-auto sm:top-auto sm:bottom-0"
            />
          )}
          <div className="pointer-events-none absolute top-0 left-0 h-full w-full py-1.5">
            <div className="bg-border/0 has-hover:group-hover/button:bg-border group-active/button:bg-border group-focus-visible/button:ring-primary/8-10 h-full w-full rounded-lg group-focus-visible/button:ring-1" />
          </div>
          <p className="relative truncate py-0.5 leading-none">{tab.title}</p>
        </LinkButton>
      ))}
    </div>
  );
}

function isActive(tab: TTab, activePath: string | undefined) {
  return activePath
    ? tab.to === activePath || (!tab.strictMatch && activePath.startsWith(tab.to + "/"))
    : false;
}
