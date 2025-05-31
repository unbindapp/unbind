import BroomIcon from "@/components/icons/broom";
import { cn } from "@/components/ui/utils";
import { TDeploymentShallow } from "@/server/trpc/api/deployments/types";
import { CircleCheckIcon, HourglassIcon, LoaderIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import { FC, useMemo } from "react";

type TProps = {
  deployment: TDeploymentShallow | undefined;
  isPlaceholder: boolean | undefined;
  iconClassName?: string;
  className?: string;
};

export default function DeploymentStatusChip({
  deployment,
  isPlaceholder,
  iconClassName,
  className,
}: TProps) {
  const [statusText, Icon]: [string, FC<{ className?: string }>] = useMemo(() => {
    if (isPlaceholder || !deployment) return ["LOADING", AnimatedLoaderIcon];
    if (deployment.status === "build-queued") return ["QUEUED", AnimatedHourglassIcon];
    if (deployment.status === "build-pending") return ["PENDING", AnimatedHourglassIcon];
    if (deployment.status === "build-running") return ["BUILDING", AnimatedLoaderIcon];
    if (deployment.status === "build-cancelled") return ["CANCELLED", XIcon];
    if (deployment.status === "build-failed") return ["FAILED", TriangleAlertIcon];
    if (deployment.status === "build-succeeded") return ["LAUNCHING", AnimatedLoaderIcon];
    if (deployment.status === "launching") return ["LAUNCHING", AnimatedLoaderIcon];
    if (deployment.status === "launch-error") return ["ERROR", AnimatedLoaderIcon];
    if (deployment.status === "active") return ["ACTIVE", CircleCheckIcon];
    if (deployment.status === "crashing") return ["CRASHING", TriangleAlertIcon];
    return ["REMOVED", BroomIcon];
  }, [deployment, isPlaceholder]);

  return (
    <div
      data-placeholder={isPlaceholder ? true : undefined}
      data-color={getDeploymentStatusChipColor({ deployment, isPlaceholder })}
      className={cn(
        "bg-foreground/8 text-muted-foreground data-[color=wait]:bg-wait/12 data-[color=destructive]:bg-destructive/12 data-[color=destructive]:text-destructive data-[color=wait]:text-wait data-[color=process]:bg-process/12 data-[color=process]:text-process data-[color=success]:bg-success/12 data-[color=success]:text-success data-placeholder:bg-muted-more-foreground data-placeholder:animate-skeleton flex min-w-0 shrink items-center justify-start gap-1.5 rounded-md px-2 py-1.25 text-sm font-medium data-placeholder:text-transparent",
        className,
      )}
    >
      <Icon className={cn("-ml-0.25 size-3.5 shrink-0", iconClassName)} />
      <p className="min-w-0 shrink leading-tight">{statusText}</p>
    </div>
  );
}

function AnimatedHourglassIcon({ className }: { className?: string }) {
  return <HourglassIcon className={cn("animate-hourglass", className)} />;
}

function AnimatedLoaderIcon({ className }: { className?: string }) {
  return <LoaderIcon className={cn("animate-spin", className)} />;
}

type TDeploymentStatusColor = "default" | "wait" | "process" | "destructive" | "success";

export function getDeploymentStatusChipColor({
  deployment,
  isPlaceholder,
}: {
  deployment?: TDeploymentShallow;
  isPlaceholder?: boolean;
}): TDeploymentStatusColor {
  if (isPlaceholder || !deployment) return "default";
  if (deployment.status === "build-queued") return "wait";
  if (deployment.status === "build-pending") return "wait";
  if (deployment.status === "build-running") return "process";
  if (deployment.status === "build-failed") return "destructive";
  if (deployment.status === "build-cancelled") return "default";
  if (deployment.status === "build-succeeded") return "process";
  if (deployment.status === "launching") return "process";
  if (deployment.status === "launch-error") return "destructive";
  if (deployment.status === "crashing") return "destructive";
  if (deployment.status === "active") return "success";
  if (deployment.status === "removed") return "default";
  return "default";
}
