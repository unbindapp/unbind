"use client";

import TabIndicator from "@/components/navigation/tab-indicator";
import { LinkButton } from "@/components/ui/button";
import { usePathname } from "next/navigation";
import { FC, useEffect, useState } from "react";

export type TSettingsTab = {
  label: string;
  href: string;
  Icon: FC<{ className?: string; style?: { transform?: string } }>;
  strictMatch?: boolean;
};

type TProps = {
  tabs: TSettingsTab[];
};

export default function SettingsTabBar({ tabs }: TProps) {
  const pathname = usePathname();
  const [activeTabPath, setActiveTabPath] = useState<string | undefined>(pathname);

  useEffect(() => {
    setActiveTabPath(pathname);
  }, [pathname]);

  return (
    <div className="bg-background sticky top-0 left-0 z-10 flex max-h-full w-full flex-row items-center overflow-auto border-b sm:top-[calc(5.75rem+2px)] md:max-h-[calc(100svh-6rem)] md:w-52 md:flex-col md:items-start md:justify-start md:border-0 lg:top-[calc(3rem-1px)] lg:max-h-[calc(100svh-3rem-1px)]">
      <div className="flex w-full flex-row sm:px-3 md:flex-col md:p-1 md:pb-12">
        {tabs.map((tab) => (
          <LinkButton
            forceMinSize={false}
            key={tab.href}
            data-active={isActive(tab, activeTabPath) ? true : undefined}
            onClick={() => setActiveTabPath(tab.href)}
            href={tab.href}
            variant="ghost"
            className="text-muted-foreground data-active:text-foreground group/button shrink-0 justify-start gap-1.5 rounded-lg px-3 py-4.25 text-left text-sm font-medium focus-visible:ring-0 focus-visible:ring-offset-0 active:bg-transparent has-hover:hover:bg-transparent sm:py-4 md:w-full md:gap-2.5 md:px-4 md:py-4 md:text-base"
          >
            <div className="absolute top-0 left-0 h-full w-full py-1.5 md:py-0.5">
              <div className="has-hover:group-hover/button:bg-border group-active/button:bg-border group-focus-visible/button:ring-offset-background group-focus-visible/button:ring-primary/50 h-full w-full rounded-lg group-focus-visible/button:ring-1 group-focus-visible/button:ring-offset-2" />
            </div>
            {isActive(tab, activeTabPath) && (
              <TabIndicator
                layoutId="sidebar-tab-indicator"
                className="md:w-2px md:top-2.75 md:h-[calc(100%-1.375rem)]"
              />
            )}
            <tab.Icon className="relative -my-1 -ml-0.25 size-4 shrink-0 translate-z-0 md:-ml-1 md:size-5" />
            <p className="relative leading-none whitespace-nowrap md:min-w-0 md:shrink md:whitespace-normal">
              {tab.label}
            </p>
          </LinkButton>
        ))}
      </div>
    </div>
  );
}

function isActive(tab: TSettingsTab, activePath: string | undefined) {
  return activePath
    ? tab.href === activePath || (!tab.strictMatch && activePath.startsWith(tab.href + "/"))
    : false;
}
