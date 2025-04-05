import BrandIcon from "@/components/icons/brand";
import BroomIcon from "@/components/icons/broom";
import DeploymentTime from "@/components/service/panel/tabs/deployments/deployment-time";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { TDeploymentShallow } from "@/server/trpc/api/deployments/types";
import {
  CircleCheckIcon,
  EllipsisVerticalIcon,
  LoaderIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { HTMLAttributes, useMemo } from "react";

type TProps = HTMLAttributes<HTMLDivElement> &
  (
    | {
        deployment: TDeploymentShallow;
        currentDeployment: TDeploymentShallow | undefined;
        isPlaceholder?: never;
        withCurrentTag?: boolean;
      }
    | {
        isPlaceholder: true;
        currentDeployment?: never;
        deployment?: never;
        withCurrentTag?: never;
      }
  );

export default function DeploymentCard({
  deployment,
  currentDeployment,
  isPlaceholder,
  ...rest
}: TProps) {
  const LoaderWithSpin = ({ className }: { className?: string }) => (
    <LoaderIcon className={cn("animate-spin", className)} />
  );
  const Icon = useMemo(() => {
    if (isPlaceholder) return LoaderWithSpin;
    if (deployment.status === "building" || deployment.status === "queued") return LoaderWithSpin;
    if (
      deployment.status === "succeeded" &&
      currentDeployment &&
      deployment.id === currentDeployment.id
    )
      return CircleCheckIcon;
    if (deployment.status === "failed") return TriangleAlertIcon;
    if (deployment.status === "cancelled") return XIcon;
    return BroomIcon;
  }, [isPlaceholder, deployment?.status, deployment?.id, currentDeployment]);

  return (
    <div
      {...rest}
      data-color={getColor({ deployment, isPlaceholder, currentDeployment })}
      data-placeholder={isPlaceholder ? true : undefined}
      className="group/card has-hover:hover:bg-border/50 has-hover:hover:data-[color=destructive]:bg-destructive/8 active:data-[color=destructive]:bg-destructive/8 focus-visible:data-[color=destructive]:bg-destructive/8 focus-within:data-[color=destructive]:bg-destructive/8 data-[color=destructive]:bg-destructive/4 has-hover:hover:data-[color=process]:bg-process/8 active:data-[color=process]:bg-process/8 focus-visible:data-[color=process]:bg-process/8 focus-within:data-[color=process]:bg-process/8 data-[color=process]:bg-process/4 data-[color=success]:bg-success/4 has-hover:hover:data-[color=success]:bg-success/8 active:hover:data-[color=success]:bg-success/8 focus-visible:hover:data-[color=success]:bg-success/8 focus-within:hover:data-[color=success]:bg-success/8 data-[color=destructive]:border-destructive/20 data-[color=process]:border-process/20 data-[color=success]:border-success/20 relative flex w-full flex-row items-stretch rounded-xl border p-2"
    >
      <div className="flex min-w-0 flex-1 flex-col py-1 pr-6 pl-1.5 sm:flex-row sm:items-center sm:px-2 sm:py-1.5">
        <div className="flex shrink-0 items-center justify-start pr-3 sm:w-34">
          <div className="bg-foreground/8 text-muted-foreground group-data-[color=destructive]/card:bg-destructive/12 group-data-[color=destructive]/card:text-destructive group-data-[color=process]/card:bg-process/12 group-data-[color=process]/card:text-process group-data-[color=success]/card:bg-success/12 group-data-[color=success]/card:text-success group-data-placeholder/card:bg-muted-more-foreground group-data-placeholder/card:animate-skeleton flex min-w-0 shrink items-center justify-start gap-1.5 rounded-md px-2 py-1.25 text-sm font-medium group-data-placeholder/card:text-transparent">
            <Icon className="-ml-0.25 size-3.5 shrink-0" />
            <p className="min-w-0 shrink leading-tight">
              {isPlaceholder
                ? "LOADING"
                : deployment.status === "building" || deployment.status === "queued"
                  ? "BUILDING"
                  : deployment.status === "succeeded" &&
                      currentDeployment &&
                      deployment.id === currentDeployment.id
                    ? "ACTIVE"
                    : deployment.status === "failed"
                      ? "FAILED"
                      : deployment.status === "cancelled"
                        ? "CANCELLED"
                        : "REMOVED"}
            </p>
          </div>
        </div>
        <div className="mt-2 flex shrink-0 flex-col items-start justify-center sm:mt-0">
          <BrandIcon
            brand={isPlaceholder ? "github" : /* deployment.source */ "github"}
            color="brand"
            className="group-data-placeholder/card:bg-foreground group-data-placeholder/card:animate-skeleton size-6 group-data-placeholder/card:rounded-full group-data-placeholder/card:text-transparent"
          />
        </div>
        <div className="mt-1.5 flex min-w-0 flex-1 flex-col items-start gap-1.25 pr-2 pb-0.5 sm:mt-0 sm:pl-3">
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
          className="text-muted-more-foreground absolute top-1 right-1 shrink-0 rounded-lg group-data-placeholder/line:text-transparent sm:relative sm:top-0 sm:right-0 sm:-mr-2.5"
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

function getColor({
  deployment,
  isPlaceholder,
  currentDeployment,
}: {
  deployment?: TDeploymentShallow;
  isPlaceholder?: boolean;
  currentDeployment?: TDeploymentShallow;
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
        if (currentDeployment && deployment && currentDeployment.id === deployment.id)
          return "success";
        return "default";
      default:
        return "default";
    }
  }
}
