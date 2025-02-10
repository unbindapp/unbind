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
    <p className="shrink min-w-0 font-medium overflow-hidden overflow-ellipsis whitespace-nowrap text-sm">
      {!service.lastDeployment || !timeDiffStr
        ? "No deployments yet"
        : `${timeDiffStr} via ${sourceToTitle[service.lastDeployment.source]}`}
    </p>
  );
}
