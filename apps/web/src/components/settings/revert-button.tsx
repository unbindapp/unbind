import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { RotateCcwIcon } from "lucide-react";

type TProps = {
  onClick: () => void;
  isStaged: boolean;
  disabled?: boolean;
  className?: string;
  classNameIcon?: string;
};

export function RevertButton({ onClick, isStaged, disabled, className, classNameIcon }: TProps) {
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
      <RotateCcwIcon className={cn("size-4.5", classNameIcon)} />
    </Button>
  );
}
