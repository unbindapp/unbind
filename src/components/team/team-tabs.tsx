"use client";

import TabIndicator from "@/components/navigation/tab-indicator";
import { LinkButton } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { usePathname } from "next/navigation";
import { createRef, useEffect, useMemo, useState } from "react";

type TTab = {
  title: string;
  relativeHref: string;
};

const tabs: TTab[] = [
  {
    title: "Projects",
    relativeHref: "",
  },
  {
    title: "Settings",
    relativeHref: "/settings",
  },
];

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
  const pathname = usePathname();
  const segments = pathname.split("/");
  const base = `/${segments[1]}`;
  const relativePath = pathname.replace(base, "");
  const [activeTabPath, setActiveTabPath] = useState(relativePath);
  const activeTabIndex = tabs.findIndex(
    (tab) => tab.relativeHref === activeTabPath
  );
  const refs = useMemo(
    () => tabs.map(() => createRef<HTMLAnchorElement>()),
    [tabs]
  );

  useEffect(() => {
    setActiveTabPath(relativePath);
  }, [relativePath]);

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
          <div className="flex justify-start items-stretch relative">
            {tabs.map((tab, index) => (
              <LinkButton
                ref={refs[index]}
                data-active={
                  tab.relativeHref === activeTabPath ? true : undefined
                }
                key={tab.relativeHref}
                className={cn(
                  `font-medium text-sm px-3 py-4.25 sm:py-4 rounded leading-none text-muted-foreground 
                  has-hover:hover:bg-transparent active:bg-transparent group/button data-[active]:text-foreground
                  focus-visible:ring-0 focus-visible:ring-offset-0`,
                  classNameButton
                )}
                variant="ghost"
                href={base + tab.relativeHref}
                onClick={() => setActiveTabPath(tab.relativeHref)}
              >
                <div className="absolute left-0 top-0 w-full h-full pointer-events-none py-1.5">
                  <div
                    className="w-full h-full rounded-lg bg-border/0 has-hover:group-hover/button:bg-border group-active/button:bg-border
                  group-focus-visible/button:ring-1 group-focus-visible/button:ring-primary/50"
                  />
                </div>

                <p className="relative">{tab.title}</p>
              </LinkButton>
            ))}
            <TabIndicator
              activeTabIndex={activeTabIndex}
              refs={refs}
              className="top-0 sm:top-auto sm:bottom-0"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
