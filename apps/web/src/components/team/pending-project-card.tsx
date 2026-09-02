import { TPendingProject } from "@/components/stores/pending/pending-entity-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { LoaderIcon } from "lucide-react";

type TProps = {
  pendingProject: TPendingProject;
  className?: string;
};

export default function PendingProjectCard({ pendingProject, className }: TProps) {
  return (
    <li
      className={cn(
        "group/item animate-skeleton-smooth pointer-events-none flex w-full flex-col p-1 opacity-(--skeleton-smooth-opacity)",
        className,
      )}
    >
      <Button
        variant="card"
        disabled
        fadeOnDisabled={false}
        className="flex min-h-38 w-full flex-col items-start gap-12 rounded-xl border px-5 py-3.5 text-left font-semibold"
      >
        <h3 className="max-w-full overflow-hidden leading-tight text-ellipsis whitespace-nowrap">
          {pendingProject.name}
        </h3>
        <div className="flex w-full flex-1 flex-col justify-end">
          <div className="text-muted-foreground flex w-full items-center gap-1.75 text-sm font-medium">
            <LoaderIcon className="size-3.5 shrink-0 animate-spin" />
            <p className="min-w-0 shrink truncate">Creating</p>
          </div>
        </div>
      </Button>
    </li>
  );
}
