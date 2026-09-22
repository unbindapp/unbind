import { Button, type TButtonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { useCopyToClipboard } from "@/lib/use-copy";
import { CheckIcon, CopyIcon } from "lucide-react";

// The copy icon of apps/web: rotates into a green check while `data-copied` is set on
// the surrounding group/button.
export function CopyStateIcon({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative size-4.5 shrink-0 transition-transform group-data-copied/button:rotate-45",
        className,
      )}
    >
      <CopyIcon className="size-full group-data-copied/button:opacity-0" />
      <CheckIcon
        strokeWidth={3}
        className="group-data-copied/button:text-success absolute top-0 left-0 size-full -rotate-45 opacity-0 group-data-copied/button:opacity-100"
      />
    </span>
  );
}

type TProps = {
  valueToCopy: string | (() => string | undefined);
  className?: string;
  classNameIcon?: string;
  variant?: TButtonVariants["variant"];
};

export function CopyButton({ valueToCopy, className, classNameIcon, variant }: TProps) {
  const { copyToClipboard, isRecentlyCopied } = useCopyToClipboard();

  function copy() {
    const value = typeof valueToCopy === "function" ? valueToCopy() : valueToCopy;
    if (value === undefined) return;
    copyToClipboard(value);
  }

  return (
    <Button
      type="button"
      aria-label={isRecentlyCopied ? "Copied" : "Copy to clipboard"}
      data-copied={isRecentlyCopied || undefined}
      onClick={copy}
      variant={variant ?? "ghost"}
      forceMinSize="medium"
      size="icon"
      className={cn("text-muted-more-foreground rounded-lg sm:rounded-md", className)}
    >
      <CopyStateIcon className={classNameIcon} />
    </Button>
  );
}
