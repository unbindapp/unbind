"use client";

import SettingsTabIcon, { TSettingsTabVariant } from "@/components/icons/settings-tab-icon";
import TabIndicator from "@/components/navigation/tab-indicator";
import ScrollOverflowIndicator from "@/components/scroll-overflow-indicator";
import { LinkButton } from "@/components/ui/button";
import { useScrollOverflow } from "@/lib/hooks/use-scroll-overflow";
import { useLocation, type LinkProps } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

export type TSettingsTab = {
  label: string;
  icon: TSettingsTabVariant;
  strictMatch?: boolean;
  // Resolved pathname used only for active-tab matching (navigation uses `link`,
  // built with TanStack's `linkOptions` helper at the call site for type safety).
  matchPath: string;
  link: LinkProps;
};

type TProps = {
  tabs: TSettingsTab[];
};

export default function SettingsTabs({ tabs }: TProps) {
  const pathname = useLocation({ select: (l) => l.pathname });
  const [activeTabPath, setActiveTabPath] = useState<string | undefined>(pathname);

  const navRef = useRef<HTMLElement>(null);
  const { canScrollRight } = useScrollOverflow({ ref: navRef, offset: 44 });

  useEffect(() => {
    setActiveTabPath(pathname);
  }, [pathname]);

  return (
    <div className="sticky top-0 left-0 w-full overflow-hidden md:w-52">
      <nav
        ref={navRef}
        className="bg-background max-md:touch:scrollbar-hidden z-10 flex max-h-full w-full flex-row items-center overflow-auto border-b pr-6 sm:top-23.5 md:max-h-[calc(100svh-6rem)] md:flex-col md:items-start md:justify-start md:border-0 md:pr-0 lg:top-11.75 lg:max-h-[calc(100svh-3rem-1px)]"
      >
        <div className="flex flex-row sm:px-3 md:flex-col md:p-1">
          {tabs.map((tab) => (
            <LinkButton
              {...tab.link}
              search={(prev) => prev}
              forceMinSize={false}
              key={tab.matchPath}
              data-active={isActive(tab, activeTabPath) || undefined}
              onClick={() => setActiveTabPath(tab.matchPath)}
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
              <SettingsTabIcon
                variant={tab.icon}
                className="relative -my-1 -ml-px size-4 shrink-0 translate-z-0 md:-ml-1 md:size-5"
              />
              <p className="relative leading-none whitespace-nowrap md:min-w-0 md:shrink md:whitespace-normal">
                {tab.label}
              </p>
            </LinkButton>
          ))}
        </div>
      </nav>
      <ScrollOverflowIndicator canScrollRight={canScrollRight} className="md:hidden" />
    </div>
  );
}

function isActive(tab: TSettingsTab, activePath: string | undefined) {
  return activePath
    ? tab.matchPath === activePath ||
        (!tab.strictMatch && activePath.startsWith(tab.matchPath + "/"))
    : false;
}
