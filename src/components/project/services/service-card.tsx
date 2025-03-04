"use client";

import ServiceIcon from "@/components/icons/service";
import LastDeploymentTime from "@/components/project/services/last-deployment-time";
import ServicePanel from "@/components/project/services/service-panel";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { TService } from "@/server/trpc/api/main/router";

type TProps = {
  service: TService;
  className?: string;
  classNameCard?: string;
};

export default function ServiceCard({ service, className, classNameCard }: TProps) {
  return (
    <li className={cn("flex w-full flex-col p-1", className)}>
      <ServicePanel service={service}>
        <Button
          variant="ghost"
          className={cn(
            "bg-background-hover flex min-h-36 w-full flex-col items-start gap-12 rounded-xl border px-5 py-3.5 text-left",
            classNameCard,
          )}
        >
          <div className="flex w-full items-center justify-start gap-2">
            <ServiceIcon color="brand" variant={service.type} className="-ml-1 size-6" />
            <h3 className="min-w-0 shrink overflow-hidden leading-tight font-bold text-ellipsis whitespace-nowrap">
              {service.title}
            </h3>
          </div>
          <div className="flex w-full flex-1 flex-col justify-end">
            <div className="text-muted-foreground flex w-full items-center justify-between">
              <LastDeploymentTime service={service} />
            </div>
          </div>
        </Button>
      </ServicePanel>
    </li>
  );
}
