import { sourceToTitle } from "@/lib/constants";
import { useTimeDifference } from "@/lib/hooks/use-time-difference";
import { TService } from "@/server/trpc/api/services/types";

type TProps = {
  service: TService;
};

export default function LastDeploymentTime({ service }: TProps) {
  const lastDeployment = service.last_deployment;
  const { str: timeDiffStr } = useTimeDifference({
    timestamp: lastDeployment ? new Date(lastDeployment.created_at).getTime() : 0,
  });

  return (
    <p
      suppressHydrationWarning
      className="min-w-0 shrink overflow-hidden text-sm font-medium text-ellipsis whitespace-nowrap"
    >
      {lastDeployment
        ? `${timeDiffStr} via ${sourceToTitle[service.config.type] || "Unknown"}`
        : "No deployments yet"}
    </p>
  );
}
