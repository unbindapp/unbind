import { useTimeDifference } from "@/lib/hooks/use-time-difference";
import { TDeploymentSource, TService } from "@/server/trpc/api/main/router";

type Props = {
  service: TService;
};

const sourceToTitle: Record<TDeploymentSource, string> = {
  github: "GitHub",
  docker: "Docker",
};

export default function LastDeploymentTime({ service }: Props) {
  const { str: timeDiffStr } = useTimeDifference({
    timestamp: service.lastDeployment?.timestamp,
  });

  return (
    <p
      suppressHydrationWarning
      className="min-w-0 shrink overflow-hidden text-sm font-medium text-ellipsis whitespace-nowrap"
    >
      {!service.lastDeployment || !timeDiffStr
        ? "No deployments yet"
        : `${timeDiffStr} via ${sourceToTitle[service.lastDeployment.source]}`}
    </p>
  );
}
