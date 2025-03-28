import BroomIcon from "@/components/icons/broom";
import ServiceIcon from "@/components/icons/service";
import DeploymentTime from "@/components/service/tabs/deployments/deployment-time";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { TDeploymentShallow } from "@/server/trpc/api/deployments/types";
import { CircleCheckIcon, EllipsisVerticalIcon, LoaderIcon, TriangleAlertIcon } from "lucide-react";
import { useMemo } from "react";

type TProps =
  | {
      deployment: TDeploymentShallow;
      lastDeploymentId?: string;
      isPlaceholder?: never;
    }
  | {
      isPlaceholder: true;
      lastDeploymentId?: string;
      deployment?: never;
    };

function getColor({
  deployment,
  isPlaceholder,
  lastDeploymentId,
}: {
  deployment?: TDeploymentShallow;
  isPlaceholder?: boolean;
  lastDeploymentId?: string;
}) {
  if (isPlaceholder || !deployment) {
    return "default";
  } else {
    switch (deployment.status) {
      case "queued":
        return "process";
      case "building":
        return "process";
      case "failed":
        return "destructive";
      case "cancelled":
        return "default";
      case "succeeded":
        if (lastDeploymentId && deployment && lastDeploymentId === deployment.id) return "success";
        return "default";
      default:
        return "default";
    }
  }
}

export default function DeploymentCard({ deployment, lastDeploymentId, isPlaceholder }: TProps) {
  const LoaderWithSpin = ({ className }: { className?: string }) => (
    <LoaderIcon className={cn("animate-spin", className)} />
  );
  const Icon = useMemo(() => {
    if (isPlaceholder) return LoaderWithSpin;
    if (deployment.status === "building" || deployment.status === "queued") return LoaderWithSpin;
    if (deployment.status === "succeeded" && deployment.id === lastDeploymentId)
      return CircleCheckIcon;
    if (deployment.status === "failed") return TriangleAlertIcon;
    return BroomIcon;
  }, [isPlaceholder, deployment?.status, deployment?.id, lastDeploymentId]);

  return (
    <div
      data-color={getColor({ deployment, isPlaceholder, lastDeploymentId })}
      data-placeholder={isPlaceholder ? true : undefined}
      className="group/card data-[color=destructive]:bg-destructive/4 data-[color=process]:bg-process/4 data-[color=success]:bg-success/4 data-[color=destructive]:border-destructive/20 data-[color=process]:border-process/20 data-[color=success]:border-success/20 relative flex w-full flex-row items-stretch rounded-xl border p-2"
    >
      <div className="bg-foreground/8 group-data-[color=destructive]/card:bg-destructive group-data-[color=process]/card:bg-process group-data-[color=success]/card:bg-success group-data-placeholder/card:bg-muted-more-foreground group-data-placeholder/card:animate-skeleton w-1 self-stretch rounded-full" />
      <div className="flex min-w-0 flex-1 flex-col py-0.5 pr-6 pl-3 sm:flex-row sm:items-center sm:px-3 sm:py-2">
        <div className="flex shrink-0 items-center justify-start pr-3 sm:w-32">
          <div className="bg-foreground/8 text-muted-foreground group-data-[color=destructive]/card:bg-destructive/12 group-data-[color=destructive]/card:text-destructive group-data-[color=process]/card:bg-process/12 group-data-[color=process]/card:text-process group-data-[color=success]/card:bg-success/12 group-data-[color=success]/card:text-success group-data-placeholder/card:bg-muted-more-foreground group-data-placeholder/card:animate-skeleton flex min-w-0 shrink items-center justify-start gap-1.5 rounded-md px-2 py-1.25 text-sm font-medium group-data-placeholder/card:text-transparent">
            <Icon className="-ml-0.25 size-3.5 shrink-0" />
            <p className="min-w-0 shrink leading-tight">
              {isPlaceholder
                ? "LOADING"
                : deployment.status === "building" || deployment.status === "queued"
                  ? "BUILDING"
                  : deployment.status === "succeeded" && deployment.id === lastDeploymentId
                    ? "ACTIVE"
                    : deployment.status === "failed"
                      ? "FAILED"
                      : "REMOVED"}
            </p>
          </div>
        </div>
        <div className="mt-2 flex shrink-0 flex-col items-start justify-center sm:mt-0">
          <ServiceIcon
            color="brand"
            variant={isPlaceholder ? "github" : /* deployment.source */ "github"}
            className="group-data-placeholder/card:bg-foreground group-data-placeholder/card:animate-skeleton size-6 group-data-placeholder/card:rounded-full group-data-placeholder/card:text-transparent"
          />
        </div>
        <div className="mt-2 flex min-w-0 flex-1 flex-col items-start gap-1 pr-2 pb-1 sm:mt-0 sm:pl-3">
          <p
            data-no-message={!isPlaceholder && !deployment.commit_message ? true : undefined}
            className="data-no-message:bg-border data-no-message:text-muted-foreground group-data-placeholder/card:bg-foreground group-data-placeholder/card:animate-skeleton max-w-full min-w-0 shrink leading-tight group-data-placeholder/card:rounded-md group-data-placeholder/card:text-transparent data-no-message:-my-0.25 data-no-message:rounded data-no-message:px-1.5 data-no-message:py-0.25"
          >
            {isPlaceholder
              ? "Loading message..."
              : deployment.commit_message
                ? deployment.commit_message
                : "Commit message not available"}
          </p>
          {isPlaceholder ? (
            <DeploymentTime isPlaceholder={true} />
          ) : (
            <DeploymentTime deployment={deployment} />
          )}
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="text-muted-more-foreground absolute top-1 right-1 shrink-0 rounded-lg group-data-placeholder/line:text-transparent sm:relative sm:top-0 sm:right-0 sm:-mr-3.5"
        >
          {isPlaceholder ? (
            <div className="group-data-placeholder/card:bg-muted-foreground group-data-placeholder/card:animate-skeleton size-5 group-data-placeholder/card:rounded-md" />
          ) : (
            <EllipsisVerticalIcon className="size-6" />
          )}
        </Button>
      </div>
    </div>
  );
}
