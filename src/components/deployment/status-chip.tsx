import BroomIcon from "@/components/icons/broom";
import { cn } from "@/components/ui/utils";
import { TDeploymentShallow } from "@/server/trpc/api/deployments/types";
import { CircleCheckIcon, LoaderIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import { FC, useMemo } from "react";

type TProps = {
  deployment: TDeploymentShallow | undefined;
  isPlaceholder: boolean | undefined;
  currentDeployment: TDeploymentShallow | undefined;
  iconClassName?: string;
  className?: string;
};

export default function DeploymentStatusChip({
  deployment,
  isPlaceholder,
  currentDeployment,
  iconClassName,
  className,
}: TProps) {
  const [statusText, Icon]: [string, FC<{ className?: string }>] = useMemo(() => {
    const LoaderWithSpinner = ({ className }: { className?: string }) => (
      <LoaderIcon className={cn("animate-spin", className)} />
    );
    if (isPlaceholder || !deployment) return ["LOADING", LoaderWithSpinner];
    if (deployment.status === "building") return ["BUILDING", LoaderWithSpinner];
    if (deployment.status === "queued") return ["QUEUED", LoaderWithSpinner];
    if (
      deployment.status === "succeeded" &&
      currentDeployment &&
      deployment.id === currentDeployment.id
    )
      return ["ACTIVE", CircleCheckIcon];
    if (deployment.status === "failed") return ["FAILED", TriangleAlertIcon];
    if (deployment.status === "cancelled") return ["CANCELLED", XIcon];
    return ["REMOVED", BroomIcon];
  }, [deployment, currentDeployment, isPlaceholder]);

  return (
    <div
      data-placeholder={isPlaceholder ? true : undefined}
      data-color={getDeploymentStatusChipColor({ deployment, currentDeployment, isPlaceholder })}
      className={cn(
        "bg-foreground/8 text-muted-foreground data-[color=warning]:bg-warning/12 data-[color=destructive]:bg-destructive/12 data-[color=destructive]:text-destructive data-[color=warning]:text-warning data-[color=process]:bg-process/12 data-[color=process]:text-process data-[color=success]:bg-success/12 data-[color=success]:text-success data-placeholder:bg-muted-more-foreground data-placeholder:animate-skeleton flex min-w-0 shrink items-center justify-start gap-1.5 rounded-md px-2 py-1.25 text-sm font-medium data-placeholder:text-transparent",
        className,
      )}
    >
      <Icon className={cn("-ml-0.25 size-3.5 shrink-0", iconClassName)} />
      <p className="min-w-0 shrink leading-tight">{statusText}</p>
    </div>
  );
}

export function getDeploymentStatusChipColor({
  deployment,
  isPlaceholder,
  currentDeployment,
}: {
  deployment?: TDeploymentShallow;
  isPlaceholder?: boolean;
  currentDeployment?: TDeploymentShallow;
}) {
  if (isPlaceholder || !deployment) return "default";
  if (deployment.status === "queued") return "warning";
  if (deployment.status === "building") return "process";
  if (deployment.status === "failed") return "destructive";
  if (deployment.status === "cancelled") return "default";
  if (
    deployment.status === "succeeded" &&
    currentDeployment &&
    deployment &&
    currentDeployment.id === deployment.id
  ) {
    return "success";
  }
  return "default";
}
