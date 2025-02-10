import ServiceIcon from "@/components/icons/service";
import { Button } from "@/components/ui/button";
import { useTimeDifference } from "@/lib/hooks/use-time-difference";
import { TDeployment } from "@/server/trpc/api/main/router";
import { EllipsisVerticalIcon } from "lucide-react";

type Props = {
  deployment: TDeployment;
  active: boolean;
};

export default function DeploymentCard({ deployment, active }: Props) {
  const timeAgo = useTimeDifference({ timestamp: deployment.timestamp });
  return (
    <div
      data-status={
        active === true && deployment.status === "succeeded"
          ? "success"
          : deployment.status === "failed"
          ? "destructive"
          : "default"
      }
      className="w-full flex flex-row items-stretch p-2 rounded-xl border group/card
      data-[status=destructive]/card:bg-destructive/4 data-[status=success]/card:bg-success/4
      data-[status=destructive]/card:border-destructive/20 data-[status=success]/card:border-success/20"
    >
      <div
        className="self-stretch w-1 rounded-full bg-border group-data-[status=destructive]/card:bg-destructive
        group-data-[status=success]/card:bg-success"
      />
      <div className="flex-1 min-w-0 px-3 py-2 flex items-center">
        <div className="shrink-0 min-w-28 flex items-center justify-start">
          <p
            className="bg-foreground/8 text-muted-foreground font-medium text-sm rounded-md px-2 py-1 
            group-data-[status=destructive]/card:bg-destructive/12 group-data-[status=destructive]/card:text-destructive
            group-data-[status=success]/card:bg-success/12 group-data-[status=success]/card:text-success"
          >
            {deployment.status === "succeeded" && active
              ? "ACTIVE"
              : deployment.status === "failed"
              ? "FAILED"
              : "REMOVED"}
          </p>
        </div>
        <ServiceIcon
          color="color"
          variant={deployment.source}
          className="size-6"
        />
        <div className="flex flex-1 flex-col pl-3 gap-1 shrink min-w-0">
          <p className="leading-tight">
            {deployment.source === "github"
              ? deployment.commitMessage
              : deployment.dockerImage}
          </p>
          <p className="text-muted-foreground text-sm leading-tight">
            {timeAgo}
          </p>
        </div>
        <Button
          size="icon"
          variant="foreground-ghost"
          className="shrink-0 text-muted-more-foreground rounded-lg -mr-3"
        >
          <EllipsisVerticalIcon className="size-6" />
        </Button>
      </div>
    </div>
  );
}
