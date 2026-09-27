import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { RotateCcwIcon } from "lucide-react";

type TProps = {
  onClick: () => void;
  isStaged: boolean;
  disabled?: boolean;
  className?: string;
};

export function RevertButton({ onClick, isStaged, disabled, className }: TProps) {
  return (
    <Button
      type="button"
      aria-label="Revert"
      disabled={disabled}
      onClick={onClick}
      variant={isStaged ? "ghost-change" : "ghost"}
      size="icon"
      className={cn("rounded-md", className)}
    >
      <RotateCcwIcon className="size-4.5" />
    </Button>
  );
}
