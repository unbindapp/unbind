import { Button, TButtonVariants } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { useCopyToClipboard } from "@/lib/hooks/use-copy";
import { CheckIcon, CopyIcon, MinusIcon } from "lucide-react";

type TProps = {
  valueToCopy?: string;
  disableCopy?: boolean;
  disabled?: boolean;
  isPlaceholder?: boolean;
  className?: string;
  classNameIcon?: string;
  variant?: TButtonVariants["variant"];
};

export default function CopyButton({
  valueToCopy,
  disableCopy,
  disabled,
  isPlaceholder,
  className,
  classNameIcon,
  variant,
}: TProps) {
  const { copyToClipboard, isRecentlyCopied } = useCopyToClipboard();
  return (
    <Button
      type="button"
      aria-label="Copy to clipboard"
      data-copied={isRecentlyCopied || undefined}
      onClick={
        isPlaceholder || valueToCopy === undefined ? () => null : () => copyToClipboard(valueToCopy)
      }
      variant={variant || "ghost"}
      forceMinSize="medium"
      size="icon"
      className={cn(
        "text-muted-more-foreground group/button rounded-lg group-data-placeholder/card:text-transparent sm:rounded-md",
        className,
      )}
      disabled={isPlaceholder || disableCopy || disabled}
      fadeOnDisabled={false}
    >
      <div
        className={cn(
          "relative size-4.5 transition-transform group-data-copied/button:rotate-45",
          classNameIcon,
        )}
      >
        {disableCopy ? (
          <MinusIcon className="size-full" />
        ) : (
          <>
            <CopyIcon className="size-full group-data-copied/button:opacity-0" />
            <CheckIcon
              strokeWidth={3}
              className="group-data-copied/button:text-success absolute top-0 left-0 size-full -rotate-45 opacity-0 group-data-copied/button:opacity-100"
            />
            {isPlaceholder && (
              <div className="bg-muted-more-foreground animate-skeleton absolute top-0 left-0 size-full rounded-sm" />
            )}
          </>
        )}
      </div>
    </Button>
  );
}
