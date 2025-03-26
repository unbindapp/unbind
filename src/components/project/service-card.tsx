import ServiceIcon from "@/components/icons/service";
import LastDeploymentTime from "@/components/project/last-deployment-time";
import ServicePanel from "@/components/service/panel/service-panel";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { TServiceShallow } from "@/server/trpc/api/services/types";

type TProps = {
  service: TServiceShallow;
  teamId: string;
  projectId: string;
  environmentId: string;
  className?: string;
  classNameCard?: string;
};

export default function ServiceCard({
  service,
  teamId,
  projectId,
  environmentId,
  className,
  classNameCard,
}: TProps) {
  return (
    <li className={cn("flex w-full flex-col p-1", className)}>
      <ServicePanel
        teamId={teamId}
        projectId={projectId}
        environmentId={environmentId}
        service={service}
      >
        <Button
          variant="ghost"
          className={cn(
            "bg-background-hover flex min-h-36 w-full flex-col items-start gap-12 rounded-xl border px-5 py-3.5 text-left",
            classNameCard,
          )}
        >
          <div className="flex w-full items-center justify-start gap-2">
            <ServiceIcon
              color="brand"
              variant={service.config.framework || service.config.provider}
              className="-ml-1 size-6"
            />
            <h3 className="min-w-0 shrink overflow-hidden leading-tight font-bold text-ellipsis whitespace-nowrap">
              {service.display_name}
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
