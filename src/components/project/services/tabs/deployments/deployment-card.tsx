import BroomIcon from "@/components/icons/broom";
import ServiceIcon from "@/components/icons/service";
import DeploymentTime from "@/components/project/services/tabs/deployments/deployment-time";
import { Button } from "@/components/ui/button";
import { TDeployment } from "@/server/trpc/api/main/router";
import { CircleCheckIcon, EllipsisVerticalIcon, LoaderIcon, TriangleAlertIcon } from "lucide-react";

type Props =
  | {
      deployment: TDeployment;
      active: boolean;
      isPlaceholder?: never;
    }
  | {
      isPlaceholder: true;
      deployment?: never;
      active?: never;
    };

export default function DeploymentCard({ deployment, active, isPlaceholder }: Props) {
  return (
    <div
      data-status={
        isPlaceholder
          ? "default"
          : active === true && deployment.status === "succeeded"
            ? "success"
            : deployment.status === "failed"
              ? "destructive"
              : "default"
      }
      data-placeholder={isPlaceholder ? true : undefined}
      className="group/card data-[status=destructive]/card:bg-destructive/4 data-[status=success]/card:bg-success/4 data-[status=destructive]/card:border-destructive/20 data-[status=success]/card:border-success/20 relative flex w-full flex-row items-stretch rounded-xl border p-2"
    >
      <div className="bg-foreground/8 group-data-[status=destructive]/card:bg-destructive group-data-[status=success]/card:bg-success group-data-placeholder/card:bg-muted-more-foreground group-data-placeholder/card:animate-skeleton w-1 self-stretch rounded-full" />
      <div className="flex min-w-0 flex-1 flex-col py-0.5 pr-6 pl-3 sm:flex-row sm:items-center sm:px-3 sm:py-2">
        <div className="flex shrink-0 items-center justify-start pr-3 sm:w-32">
          <div className="bg-foreground/8 text-muted-foreground group-data-[status=destructive]/card:bg-destructive/12 group-data-[status=destructive]/card:text-destructive group-data-[status=success]/card:bg-success/12 group-data-[status=success]/card:text-success group-data-placeholder/card:bg-muted-more-foreground group-data-placeholder/card:animate-skeleton flex min-w-0 shrink items-center justify-start gap-1.5 rounded-md px-2 py-1.25 text-sm font-medium group-data-placeholder/card:text-transparent">
            {isPlaceholder ? (
              <LoaderIcon className="-ml-0.25 size-3.5 shrink-0" />
            ) : deployment.status === "succeeded" && active ? (
              <CircleCheckIcon className="-ml-0.25 size-3.5 shrink-0" />
            ) : deployment.status === "failed" ? (
              <TriangleAlertIcon className="-ml-0.25 size-3.5 shrink-0" />
            ) : (
              <BroomIcon className="-ml-0.25 size-3.5 shrink-0" />
            )}
            <p className="min-w-0 shrink leading-tight">
              {isPlaceholder
                ? "LOADING"
                : deployment.status === "succeeded" && active
                  ? "ACTIVE"
                  : deployment.status === "failed"
                    ? "FAILED"
                    : "REMOVED"}
            </p>
          </div>
        </div>
        <ServiceIcon
          color="brand"
          variant={isPlaceholder ? "github" : deployment.source}
          className="group-data-placeholder/card:bg-foreground group-data-placeholder/card:animate-skeleton mt-2 size-6 group-data-placeholder/card:rounded-full group-data-placeholder/card:text-transparent sm:mt-0"
        />
        <div className="mt-2 flex min-w-0 flex-1 shrink flex-col items-start gap-1.5 pr-2 pb-1 sm:mt-0 sm:pl-3">
          <p className="group-data-placeholder/card:bg-foreground group-data-placeholder/card:animate-skeleton min-w-0 shrink leading-tight group-data-placeholder/card:rounded-md group-data-placeholder/card:text-transparent">
            {isPlaceholder
              ? "Loading message..."
              : deployment.source === "github"
                ? deployment.commitMessage
                : deployment.dockerImage}
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
