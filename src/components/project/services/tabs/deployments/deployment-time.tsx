import { useTimeDifference } from "@/lib/hooks/use-time-difference";
import { TDeployment } from "@/server/trpc/api/main/router";

type TProps =
  | {
      deployment: TDeployment;
      isPlaceholder?: never;
    }
  | {
      deployment?: never;
      isPlaceholder: true;
    };

export default function DeploymentTime({ deployment, isPlaceholder }: TProps) {
  const { str } = useTimeDifference({
    timestamp: isPlaceholder ? Date.now() : deployment.timestamp,
  });
  return (
    <p className="text-muted-foreground group-data-placeholder/card:bg-muted-foreground group-data-placeholder/card:animate-skeleton min-w-0 shrink text-sm leading-tight group-data-placeholder/card:rounded-md group-data-placeholder/card:text-transparent">
      {isPlaceholder ? "1 hr. ago" : str}
    </p>
  );
}
