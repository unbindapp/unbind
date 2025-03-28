import { useTimeDifference } from "@/lib/hooks/use-time-difference";
import { TDeploymentShallow } from "@/server/trpc/api/deployments/types";
import Image from "next/image";

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
    <div
      data-placeholder={isPlaceholder ? true : undefined}
      className="group/time flex min-w-0 shrink items-center justify-start gap-1.5"
    >
      {isPlaceholder ? (
        <div className="bg-muted-foreground animate-skeleton size-4.5 rounded-full" />
      ) : deployment?.commit_author ? (
        <Image
          alt="Avatar"
          width={24}
          height={24}
          className="bg-border size-4.5 rounded-full border"
          src={deployment.commit_author.avatar_url}
        />
      ) : (
        <div className="-ml-1.5 h-4.5" />
      )}
      <p className="text-muted-foreground group-data-placeholder/time:bg-muted-foreground group-data-placeholder/time:animate-skeleton min-w-0 shrink text-sm leading-tight group-data-placeholder/time:rounded-md group-data-placeholder/time:text-transparent">
        {isPlaceholder ? "1 hr. ago" : str}
      </p>
    </div>
  );
}
