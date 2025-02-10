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
    title: "Services",
    relativeHref: "",
  },
  {
    title: "Logs",
    relativeHref: "/logs",
  },
  {
    title: "Metrics",
    relativeHref: "/metrics",
  },
  {
    title: "Settings",
    relativeHref: "/settings",
  },
];

export default function ProjectTabs({
  className,
  layoutId,
}: {
  className?: string;
  layoutId: string;
}) {
  const pathname = usePathname();
  const segments = pathname.split("environment/");
  const subSegment = segments[1].split("/")[0];
  const base = segments[0] + "environment/" + subSegment;
  const relativePath = pathname.replace(base, "");
  const [activeTabPath, setActiveTabPath] = useState(relativePath);

  useEffect(() => {
    setActiveTabPath(relativePath);
  }, [relativePath]);

  return (
    <div className={cn("flex-1 min-w-0 overflow-hidden", className)}>
      <div className="flex-1 min-w-0 overflow-auto">
        <div className="px-1 sm:px-3 flex justify-start items-center">
          {tabs.map((tab) => (
            <LinkButton
              data-active={
                tab.relativeHref === activeTabPath ? true : undefined
              }
              key={tab.relativeHref}
              className="font-medium text-sm px-3 pt-3.5 pb-4 rounded leading-none text-muted-foreground 
              not-touch:hover:bg-transparent active:bg-transparent group/button data-[active]:text-foreground"
              variant="ghost"
              href={base + tab.relativeHref}
              onClick={() => setActiveTabPath(tab.relativeHref)}
            >
              <div className="absolute w-full h-full pointer-events-none py-1.5">
                <div
                  className="w-full h-full rounded-md bg-border/0 
                  not-touch:group-hover/button:bg-border group-active/button:bg-border"
                />
              </div>
              {tab.relativeHref === activeTabPath && (
                <motion.div
                  transition={{ duration: 0.15 }}
                  layoutId={layoutId}
                  className="w-full h-2px absolute left-0 bottom-0 bg-foreground rounded-full"
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
