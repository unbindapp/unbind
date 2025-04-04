import AnimatedTimerIcon from "@/components/icons/animated-timer";
import { useTime } from "@/components/providers/time-provider";
import { cn } from "@/components/ui/utils";
import { useTimeDifference } from "@/lib/hooks/use-time-difference";
import { TDeploymentShallow } from "@/server/trpc/api/deployments/types";
import Image from "next/image";

type TProps = {
  className?: string;
} & (
  | {
      deployment: TDeploymentShallow;
      isPlaceholder?: never;
    }
  | {
      deployment?: never;
      isPlaceholder: true;
    }
);

export default function DeploymentTime({ deployment, isPlaceholder, className }: TProps) {
  const { now } = useTime();
  const { str } = useTimeDifference({
    timestamp: isPlaceholder ? Date.now() : new Date(deployment.created_at).getTime(),
  });

  const durationStr = isPlaceholder
    ? undefined
    : deployment.completed_at && deployment.created_at
      ? getDurationStr({ end: deployment.completed_at, start: deployment.created_at })
      : deployment.created_at &&
          (deployment.status === "building" || deployment.status === "queued")
        ? getDurationStr({ end: now, start: deployment.created_at })
        : undefined;

  const isBuilding = deployment?.status === "building" || deployment?.status === "queued";

  return (
    <div
      data-placeholder={isPlaceholder ? true : undefined}
      className={cn("group/time flex min-w-0 shrink items-center justify-start gap-1.5", className)}
    >
      {isPlaceholder ? (
        <div className="bg-muted-foreground animate-skeleton size-4.5 rounded-full" />
      ) : deployment?.commit_author ? (
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
        <p className="text-muted-foreground group-data-placeholder/time:bg-muted-foreground group-data-placeholder/time:animate-skeleton min-w-0 shrink group-data-placeholder/time:rounded-md group-data-placeholder/time:text-transparent">
          {isPlaceholder ? "1 hr. ago | 90s" : str}
        </p>
        {durationStr && <p className="text-muted-more-foreground">|</p>}
        {durationStr && (
          <div className="text-muted-foreground -my-0.25 flex min-w-0 shrink items-center justify-start gap-0.75">
            <AnimatedTimerIcon animate={isBuilding} className="-ml-0.5 size-3.5 shrink-0" />
            <p className="min-w-0 shrink">{durationStr}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function getDurationStr({ start, end }: { start: string | number; end: string | number }) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const duration = endDate.getTime() - startDate.getTime();
  const durationInSec = Math.floor(duration / 1000);
  const durationInMin = durationInSec / 60;
  if (durationInSec >= 120) {
    return `${durationInMin.toLocaleString(undefined, { maximumFractionDigits: 1 })}m`;
  }
  return `${Math.ceil(durationInSec)}s`;
}
