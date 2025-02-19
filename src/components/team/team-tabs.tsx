"use client";

import { LinkButton } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { motion } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

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
          {tabs.map((tab) => (
            <LinkButton
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
              {tab.relativeHref === activeTabPath && (
                <motion.div
                  transition={{ duration: 0.15 }}
                  layoutId={layoutId}
                  className="w-full h-2px absolute left-0 top-0 sm:top-auto sm:bottom-0 bg-foreground rounded-full"
                />
              )}
              <p className="relative">{tab.title}</p>
            </LinkButton>
          ))}
        </div>
      </div>
    </div>
  );
}
