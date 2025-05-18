import AnimatedTimerIcon from "@/components/icons/animated-timer";
import { useNow } from "@/components/providers/now-provider";
import { cn } from "@/components/ui/utils";
import { sourceToTitle } from "@/lib/constants";
import { getDurationStr, useTimeDifference } from "@/lib/hooks/use-time-difference";
import { TDeploymentShallow } from "@/server/trpc/api/deployments/types";
import { TServiceShallow } from "@/server/trpc/api/services/types";
import Image from "next/image";

type TProps = {
  className?: string;
} & (
  | {
      deployment: TDeploymentShallow;
      service: TServiceShallow;
      isPlaceholder?: never;
    }
  | {
      deployment?: never;
      service?: never;
      isPlaceholder: true;
    }
);

export default function DeploymentTime({ deployment, service, isPlaceholder, className }: TProps) {
  const now = useNow();
  const { str: deploymentTimeStr } = useTimeDifference({
    timestamp: isPlaceholder ? Date.now() : new Date(deployment.created_at).getTime(),
  });

  const durationStr = isPlaceholder
    ? undefined
    : deployment.completed_at && deployment.created_at
      ? getDurationStr({ end: deployment.completed_at, start: deployment.created_at })
      : deployment.created_at &&
          (deployment.status === "pending" ||
            deployment.status === "queued" ||
            deployment.status === "building")
        ? getDurationStr({ end: now, start: deployment.created_at })
        : undefined;

  const isBuilding =
    deployment?.status === "pending" ||
    deployment?.status === "queued" ||
    deployment?.status === "building";

  return (
    <div
      data-placeholder={isPlaceholder ? true : undefined}
      className={cn("group/time flex min-w-0 shrink items-center justify-start gap-1.5", className)}
    >
      {isPlaceholder ? (
        <div className="bg-muted-foreground animate-skeleton size-4.5 rounded-full" />
      ) : deployment?.commit_author?.avatar_url ? (
        <Image
          alt="Avatar"
          width={24}
          height={24}
          className="bg-border size-4.5 rounded-full border"
          src={deployment.commit_author.avatar_url}
        />
      ) : (
        <div className="-ml-1.5 h-4.5" />
      )}
      <div className="flex min-w-0 shrink flex-wrap items-center justify-start gap-1 space-x-1 text-sm leading-tight">
        {!isBuilding && (
          <>
            <p className="text-muted-foreground group-data-placeholder/time:bg-muted-foreground group-data-placeholder/time:animate-skeleton min-w-0 shrink group-data-placeholder/time:rounded-md group-data-placeholder/time:text-transparent">
              {isPlaceholder
                ? "1 hr. ago | 90s"
                : `${deploymentTimeStr} via ${sourceToTitle[service.type] || "Unknown"}`}
            </p>
            {durationStr && <p className="text-muted-more-foreground">|</p>}
          </>
        )}
        {durationStr && (
          <div className="text-muted-foreground flex min-w-0 shrink items-center justify-start gap-0.75 font-mono">
            <AnimatedTimerIcon animate={isBuilding} className="-ml-0.5 size-3.5 shrink-0" />
            <p className="min-w-0 shrink">{durationStr}</p>
          </div>
        )}
      </div>
    </div>
  );
}
