import { useTimeDifference } from "@/lib/hooks/use-time-difference";
import { TDeployment } from "@/server/trpc/api/main/router";

type Props =
  | {
      deployment: TDeployment;
      isPlaceholder?: never;
    }
  | {
      deployment?: never;
      isPlaceholder: true;
    };

export default function DeploymentTime({ deployment, isPlaceholder }: Props) {
  const { str } = useTimeDifference({
    timestamp: isPlaceholder ? Date.now() : deployment.timestamp,
  });
  return (
    <p
      className="text-muted-foreground text-sm leading-tight shrink min-w-0 
      group-data-[placeholder]/card:text-transparent group-data-[placeholder]/card:rounded-md group-data-[placeholder]/card:bg-muted-foreground group-data-[placeholder]/card:animate-skeleton"
    >
      {isPlaceholder ? "1 hr. ago" : str}
    </p>
  );
}
