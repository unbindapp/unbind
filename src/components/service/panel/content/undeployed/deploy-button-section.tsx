import { Button } from "@/components/ui/button";
import { LoaderIcon } from "lucide-react";

type TProps = {
  isPending: boolean;
};

export default function DeployButtonSection({ isPending }: TProps) {
  return (
    <div className="flex w-full flex-col gap-2 border-t px-3 pt-3 pb-[calc(var(--safe-area-inset-bottom)+0.75rem)] sm:px-6 sm:pt-6 sm:pb-[calc(var(--safe-area-inset-bottom)+1.5rem)]">
      <Button
        data-pending={isPending ? true : undefined}
        className="group/button data-pending:bg-foreground/60 w-full"
        disabled={isPending}
        fadeOnDisabled={false}
      >
        {isPending && (
          <div className="absolute top-0 left-0 h-full w-full items-center justify-center overflow-hidden rounded-lg">
            <div className="from-foreground/0 via-foreground to-foreground/0 animate-ping-pong absolute top-1/2 left-1/2 aspect-square w-full origin-center -translate-1/2 bg-gradient-to-r" />
          </div>
        )}
        <div className="relative flex w-full items-center justify-center gap-1.5">
          {isPending && <LoaderIcon className="-my-1 -ml-0.5 size-5 shrink-0 animate-spin" />}
          <p className="min-w-0 shrink">{isPending ? "Deploying" : "Deploy"}</p>
        </div>
      </Button>
    </div>
  );
}
