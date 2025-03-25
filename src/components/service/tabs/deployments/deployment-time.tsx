import { useTimeDifference } from "@/lib/hooks/use-time-difference";
import { TDeploymentShallow } from "@/server/trpc/api/deployments/types";

type TProps =
  | {
      deployment: TDeploymentShallow;
      isPlaceholder?: never;
    }
  | {
      deployment?: never;
      isPlaceholder: true;
    };

export default function DeploymentTime({ deployment, isPlaceholder }: TProps) {
  const { str } = useTimeDifference({
    timestamp: isPlaceholder ? Date.now() : new Date(deployment.created_at).getTime(),
  });
  return (
    <p className="text-muted-foreground group-data-placeholder/card:bg-muted-foreground group-data-placeholder/card:animate-skeleton min-w-0 shrink text-sm leading-tight group-data-placeholder/card:rounded-md group-data-placeholder/card:text-transparent">
      {isPlaceholder ? "1 hr. ago" : str}
    </p>
  );
}
