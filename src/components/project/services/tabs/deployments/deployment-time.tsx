import { useTimeDifference } from "@/lib/hooks/use-time-difference";
import { TDeployment } from "@/server/trpc/api/main/router";

type Props = {
  deployment: TDeployment;
};

export default function DeploymentTime({ deployment }: Props) {
  const { str } = useTimeDifference({ timestamp: deployment.timestamp });
  return (
    <p className="text-muted-foreground text-sm leading-tight shrink min-w-0">
      {str}
    </p>
  );
}
