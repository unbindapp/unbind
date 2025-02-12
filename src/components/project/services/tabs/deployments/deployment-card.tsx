import BroomIcon from "@/components/icons/broom";
import ServiceIcon from "@/components/icons/service";
import DeploymentTime from "@/components/project/services/tabs/deployments/deployment-time";
import { Button } from "@/components/ui/button";
import { TDeployment } from "@/server/trpc/api/main/router";
import {
  CircleCheckIcon,
  EllipsisVerticalIcon,
  TriangleAlertIcon,
} from "lucide-react";

type Props = {
  deployment: TDeployment;
  active: boolean;
};

export default function DeploymentCard({ deployment, active }: Props) {
  return (
    <div
      data-status={
        active === true && deployment.status === "succeeded"
          ? "success"
          : deployment.status === "failed"
          ? "destructive"
          : "default"
      }
      className="w-full flex flex-row items-stretch p-2 rounded-xl border group/card relative
      data-[status=destructive]/card:bg-destructive/4 data-[status=success]/card:bg-success/4
      data-[status=destructive]/card:border-destructive/20 data-[status=success]/card:border-success/20"
    >
      <div
        className="self-stretch w-1 rounded-full bg-foreground/8 group-data-[status=destructive]/card:bg-destructive
        group-data-[status=success]/card:bg-success"
      />
      <div className="flex-1 min-w-0 pl-3 pr-6 py-0.5 sm:px-3 sm:py-2 flex-col flex sm:flex-row sm:items-center">
        <div className="shrink-0 sm:w-32 flex items-center justify-start pr-3">
          <div
            className="shrink min-w-0 flex gap-1.5 items-center justify-start bg-foreground/8 text-muted-foreground 
            font-medium text-sm rounded-md px-2 py-1.25 
            group-data-[status=destructive]/card:bg-destructive/12 group-data-[status=destructive]/card:text-destructive
            group-data-[status=success]/card:bg-success/12 group-data-[status=success]/card:text-success"
          >
            {deployment.status === "succeeded" && active ? (
              <CircleCheckIcon className="size-3.5 -ml-0.25 shrink-0" />
            ) : deployment.status === "failed" ? (
              <TriangleAlertIcon className="size-3.5 -ml-0.25 shrink-0" />
            ) : (
              <BroomIcon className="size-3.5 -ml-0.25 shrink-0" />
            )}
            <p className="leading-tight shrink min-w-0">
              {deployment.status === "succeeded" && active
                ? "ACTIVE"
                : deployment.status === "failed"
                ? "FAILED"
                : "REMOVED"}
            </p>
          </div>
        </div>
        <ServiceIcon
          color="brand"
          variant={deployment.source}
          className="size-6 mt-2 sm:mt-0"
        />
        <div className="mt-2 pb-1 sm:mt-0 flex flex-1 flex-col sm:pl-3 pr-2 gap-1.5 shrink min-w-0">
          <p className="leading-tight">
            {deployment.source === "github"
              ? deployment.commitMessage
              : deployment.dockerImage}
          </p>
          <DeploymentTime deployment={deployment} />
        </div>
        <Button
          size="icon"
          variant="ghost-foreground"
          className="shrink-0 text-muted-more-foreground rounded-lg absolute right-1 top-1 sm:relative sm:-mr-3.5 sm:right-0 sm:top-0"
        >
          <EllipsisVerticalIcon className="size-6" />
        </Button>
      </div>
    </div>
  );
}
