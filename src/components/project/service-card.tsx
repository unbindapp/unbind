import { NewEntityIndicator } from "@/components/new-entity-indicator";
import LastDeploymentTime from "@/components/project/last-deployment-time";
import ServicePanel from "@/components/service/panel/service-panel";
import ServiceIcon from "@/components/service/service-icon";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { TServiceShallow } from "@/server/trpc/api/services/types";
import { ReactNode } from "react";

type TProps = {
  className?: string;
  classNameCard?: string;
} & (
  | {
      service: TServiceShallow;
      teamId: string;
      projectId: string;
      environmentId: string;
      isPlaceholder?: never;
    }
  | {
      service?: never;
      teamId?: never;
      projectId?: never;
      environmentId?: never;
      isPlaceholder: true;
    }
);

export default function ServiceCard({
  service,
  teamId,
  projectId,
  environmentId,
  isPlaceholder,
  className,
  classNameCard,
}: TProps) {
  const panelProps = isPlaceholder
    ? ({ isPlaceholder: true } as const)
    : { teamId, projectId, environmentId, service };

  return (
    <li
      data-placeholder={isPlaceholder ? true : undefined}
      className={cn("group/item flex w-full flex-col p-1", className)}
    >
      <ServicePanelOrPlaceholder {...panelProps}>
        <Button
          variant="ghost"
          className={cn(
            "bg-background-hover flex min-h-36 w-full flex-col items-start gap-8 rounded-xl border px-5 py-3.5 text-left font-semibold",
            classNameCard,
          )}
        >
          {service && <NewEntityIndicator id={service.id} />}
          <div className="flex w-full items-center justify-start gap-2">
            {!isPlaceholder ? (
              <ServiceIcon service={service} className="-ml-1 size-6" />
            ) : (
              <div className="animate-skeleton bg-foreground -ml-1 size-6 rounded-full" />
            )}
            <h3 className="group-data-placeholder/item:bg-foreground group-data-placeholder/item:animate-skeleton min-w-0 shrink overflow-hidden leading-tight text-ellipsis whitespace-nowrap group-data-placeholder/item:rounded-md group-data-placeholder/item:text-transparent">
              {!isPlaceholder ? service.name : "Loading"}
            </h3>
          </div>
          <div className="flex w-full flex-1 flex-col justify-end">
            <div className="text-muted-foreground flex w-full items-center justify-between">
              {!isPlaceholder ? (
                <LastDeploymentTime
                  className="min-w-0 shrink overflow-hidden text-sm font-medium text-ellipsis whitespace-nowrap"
                  service={service}
                />
              ) : (
                <p className="bg-muted-foreground animate-skeleton min-w-0 shrink overflow-hidden rounded-md text-sm font-medium text-ellipsis whitespace-nowrap text-transparent">
                  10 min. ago via GitHub
                </p>
              )}
            </div>
          </div>
        </Button>
      </ServicePanelOrPlaceholder>
    </li>
  );
}

function ServicePanelOrPlaceholder({
  teamId,
  projectId,
  environmentId,
  service,
  isPlaceholder,
  children,
}: { children: ReactNode } & (
  | {
      teamId: string;
      projectId: string;
      environmentId: string;
      service: TServiceShallow;
      isPlaceholder?: never;
    }
  | {
      teamId?: never;
      projectId?: never;
      environmentId?: never;
      service?: never;
      isPlaceholder: true;
    }
)) {
  if (isPlaceholder) {
    return children;
  }

  return (
    <ServicePanel
      teamId={teamId}
      projectId={projectId}
      environmentId={environmentId}
      service={service}
    >
      {children}
    </ServicePanel>
  );
}
