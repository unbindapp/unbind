"use client";

import ServiceIcon from "@/components/icons/service";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/utils";
import { useTimeDifference } from "@/lib/hooks/use-time-difference";
import { TDeploymentSource, TService } from "@/server/trpc/api/main/router";
import { XIcon } from "lucide-react";
import { useState } from "react";
import { motion } from "motion/react";

type Props = {
  service: TService;
  className?: string;
  classNameCard?: string;
};

export default function ServiceCard({
  service,
  className,
  classNameCard,
}: Props) {
  const timeDiffStr = useTimeDifference({
    timestamp: service.lastDeployment?.timestamp,
  });
  const [selectedTabValue, setSelectedTabValue] = useState(tabs[0].value);
  const [open, setOpen] = useState(false);

  return (
    <li className={cn("w-full flex flex-col p-1", className)}>
      <Drawer
        open={open}
        onOpenChange={setOpen}
        autoFocus={open}
        direction="right"
        handleOnly
      >
        <DrawerTrigger asChild>
          <Button
            variant="ghost"
            className={cn(
              "w-full flex flex-col items-start text-left min-h-36 gap-12 border bg-background-hover rounded-xl px-5 py-3.5",
              classNameCard
            )}
          >
            <div className="w-full flex items-center justify-start gap-2">
              <ServiceIcon
                color="color"
                variant={service.type}
                className="size-6 -ml-1"
              />
              <h3 className="shrink min-w-0 font-bold leading-tight whitespace-nowrap overflow-hidden overflow-ellipsis">
                {service.title}
              </h3>
            </div>
            <div className="w-full flex flex-col flex-1 justify-end">
              <div className="w-full flex items-center justify-between text-muted-foreground">
                <p className="shrink min-w-0 font-medium overflow-hidden overflow-ellipsis whitespace-nowrap text-sm">
                  {!service.lastDeployment || !timeDiffStr
                    ? "No deployments yet"
                    : `${timeDiffStr} via ${
                        sourceToTitle[service.lastDeployment.source]
                      }`}
                </p>
              </div>
            </div>
          </Button>
        </DrawerTrigger>
        <DrawerContent
          hideHandle
          className="ml-auto my-0 top-0 h-full right-0 w-192 max-w-[80%] rounded-none flex flex-col"
        >
          <div className="w-full flex items-start justify-start gap-4 px-4 pt-3 md:px-8 md:pt-6">
            <DrawerHeader className="flex-1 min-w-0 flex items-center justify-start p-0">
              <DrawerTitle className="flex-1 min-w-0 flex items-center justify-start gap-2.5">
                <ServiceIcon
                  variant={service.type}
                  color="color"
                  className="size-8 -ml-1"
                />
                <p className="shrink min-w-0 leading-tight text-2xl text-left">
                  {service.title}
                </p>
              </DrawerTitle>
            </DrawerHeader>
            <DrawerClose asChild>
              <Button
                size="icon"
                variant="ghost"
                className="text-muted-more-foreground rounded-lg shrink-0 -mr-2 -mt-1 md:-mr-5 md:-mt-3"
              >
                <XIcon className="size-5" />
              </Button>
            </DrawerClose>
          </div>
          <nav className="w-full flex items-center justify-start px-4.5 pt-3.5 border-b">
            {tabs.map((tab) => (
              <Button
                key={tab.value}
                variant="ghost"
                onClick={() => setSelectedTabValue(tab.value)}
                data-active={selectedTabValue === tab.value ? true : undefined}
                className="shrink rounded-t-md rounded-b-none min-w-0 font-medium group/button
                px-3 pt-2.5 pb-4.5 text-muted-foreground data-[active]:text-foreground not-touch:hover:bg-transparent active:bg-transparent"
              >
                <div className="absolute w-full h-full pointer-events-none py-1">
                  <div
                    className="w-full h-full rounded-lg bg-border/0 
                    not-touch:group-hover/button:bg-border group-active/button:bg-border"
                  />
                </div>
                {selectedTabValue === tab.value && (
                  <motion.div
                    transition={{ duration: 0.15 }}
                    layoutId="indicator-service-drawer-tabs"
                    className="w-full h-2px absolute left-0 bottom-0 bg-foreground rounded-full"
                  />
                )}
                <p className="shrink min-w-0 relative leading-none">
                  {tab.title}
                </p>
              </Button>
            ))}
          </nav>
          <div className="w-full flex flex-col min-h-0 flex-1">
            <div className="flex flex-col flex-1 min-h-0">
              <ScrollArea>
                <div className="w-full flex flex-col gap-2 px-4 md:px-6 py-3 md:py-5">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div
                      key={i}
                      className="border w-full h-32 rounded-xl flex items-center justify-center text-muted-more-foreground font-medium"
                    >
                      {
                        tabs.find((tab) => tab.value === selectedTabValue)
                          ?.title
                      }
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </li>
  );
}

const sourceToTitle: Record<TDeploymentSource, string> = {
  github: "GitHub",
  docker: "Docker",
};

type TTab = {
  title: string;
  value: string;
};

const tabs: TTab[] = [
  { title: "Deployments", value: "deployments" },
  { title: "Variables", value: "variables" },
  { title: "Logs", value: "logs" },
  { title: "Metrics", value: "metrics" },
  { title: "Settings", value: "settings" },
];
