"use client";

import ServiceIcon from "@/components/icons/service";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { useTimeDifference } from "@/lib/hooks/use-time-difference";
import { TDeploymentSource, TService } from "@/server/trpc/api/main/router";

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
    </li>
  );
}
