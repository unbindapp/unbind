import { cn } from "@/components/ui/utils";
import { LoaderIcon } from "lucide-react";

export type TStagedState = "new" | "updated" | "deleted";

const stagedLabels: Record<TStagedState, string> = {
  new: "New",
  updated: "Changed",
  deleted: "Removed",
};

export function StagedChip({
  staged,
  isApplying,
  className,
}: {
  staged: TStagedState;
  isApplying: boolean;
  className?: string;
}) {
  return (
    <div className={cn("bg-background shrink-0 rounded-sm", className)}>
      <p className="text-change bg-change/5-10 border-change/5-10 flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-xs font-medium">
        {isApplying && <LoaderIcon className="size-3 shrink-0 animate-spin" />}
        <span className="truncate">{isApplying ? "Applying" : stagedLabels[staged]}</span>
      </p>
    </div>
  );
}
