import { useTimeDifference } from "@/lib/hooks/use-time-difference";
import { TService } from "@/server/trpc/api/services/types";

type TProps = {
  service: TService;
};

const sourceToTitle: Record<string, string> = {
  github: "GitHub",
  git: "Git",
  docker: "Docker",
};

export default function LastDeploymentTime({ service }: TProps) {
  const { str: timeDiffStr } = useTimeDifference({
    timestamp: new Date(service.created_at).getTime(),
  });

  return (
    <p
      suppressHydrationWarning
      className="min-w-0 shrink overflow-hidden text-sm font-medium text-ellipsis whitespace-nowrap"
    >
      {`${timeDiffStr} via ${sourceToTitle[service.config.builder] || "Unknown"}`}
    </p>
  );
}
