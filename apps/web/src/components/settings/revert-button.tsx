import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { RotateCcwIcon } from "lucide-react";

type TProps = {
  isStaged: boolean;
  classNameIcon?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export function RevertButton({ isStaged, className, classNameIcon, ...rest }: TProps) {
  return (
    <Button
      type="button"
      aria-label="Revert"
      variant={isStaged ? "ghost-change" : "ghost"}
      size="icon"
      className={cn("group/button rounded-md", className)}
      {...rest}
    >
      <RotateCcwIcon className={cn("size-4.5", classNameIcon)} />
    </Button>
  );
}
