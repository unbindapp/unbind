import { Chip } from "@/components/ui/chip";

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
    <Chip isLoading={isApplying} className={className}>
      {isApplying ? "Applying" : stagedLabels[staged]}
    </Chip>
  );
}
