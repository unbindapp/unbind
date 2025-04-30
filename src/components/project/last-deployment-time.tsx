import { sourceToTitle } from "@/lib/constants";
import { useTimeDifference } from "@/lib/hooks/use-time-difference";
import { TService } from "@/server/trpc/api/services/types";

type TProps = {
  service: TService;
  className?: string;
};

export default function LastDeploymentTime({ service, className }: TProps) {
  const lastDeployment = service.last_deployment;
  const { str: timeDiffStr } = useTimeDifference({
    timestamp: lastDeployment ? new Date(lastDeployment.created_at).getTime() : 0,
  });

  return (
    <p suppressHydrationWarning className={className}>
      {lastDeployment
        ? `${timeDiffStr} via ${sourceToTitle[service.type] || "Unknown"}`
        : "No deployments yet"}
    </p>
  );
}
