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
import { cn } from "@/components/ui/utils";
import { useTimeDifference } from "@/lib/hooks/use-time-difference";
import { TDeploymentSource, TService } from "@/server/trpc/api/main/router";
import { XIcon } from "lucide-react";

type Props = {
  service: TService;
  className?: string;
};

const sourceToTitle: Record<TDeploymentSource, string> = {
  github: "GitHub",
  docker: "Docker",
};

export default function ServiceCard({ service, className }: Props) {
  const timeDiffStr = useTimeDifference({
    timestamp: service.lastDeployment?.timestamp,
  });

  return (
    <li className={cn("w-full flex flex-col p-1", className)}>
      <Drawer direction="right">
        <DrawerTrigger asChild>
          <Button
            variant="ghost"
            className="w-full flex flex-col items-start text-left min-h-36 gap-12 border bg-background-hover rounded-xl px-5 py-3.5"
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
          className="ml-auto my-0 top-0 h-full right-0 w-192 max-w-[80%] rounded-none px-4 py-3 md:px-8 md:py-6"
        >
          <div className="w-full flex items-start justify-start gap-4">
            <DrawerHeader className="flex-1 min-w-0 flex items-center justify-start p-0">
              <DrawerTitle className="flex-1 min-w-0 flex items-center justify-start gap-2.5">
                <ServiceIcon
                  variant={service.type}
                  color="color"
                  className="size-8"
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
        </DrawerContent>
      </Drawer>
    </li>
  );
}
