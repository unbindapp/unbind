import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { useCopyToClipboard } from "@/lib/hooks/use-copy";
import { CheckIcon, CopyIcon, MinusIcon } from "lucide-react";

type TProps = {
  valueToCopy?: string;
  disableCopy?: boolean;
  isPlaceholder?: boolean;
  className?: string;
  classNameIcon?: string;
};

export default function CopyButton({
  valueToCopy,
  disableCopy,
  isPlaceholder,
  className,
  classNameIcon,
}: TProps) {
  const { copyToClipboard, isRecentlyCopied } = useCopyToClipboard();
  return (
    <Button
      type="button"
      aria-label="Copy to clipboard"
      data-copied={isRecentlyCopied ? true : undefined}
      onClick={isPlaceholder || !valueToCopy ? () => null : () => copyToClipboard(valueToCopy)}
      variant="ghost"
      forceMinSize="medium"
      size="icon"
      className={cn(
        "text-muted-more-foreground group/button rounded-lg group-data-placeholder/card:text-transparent sm:rounded-md",
        className,
      )}
      disabled={isPlaceholder || disableCopy}
      fadeOnDisabled={false}
    >
      <div
        className={cn(
          "relative size-4.5 transition-transform group-data-copied/button:rotate-90",
          classNameIcon,
        )}
      >
        {disableCopy ? (
          <MinusIcon className="size-full" />
        ) : (
          <>
            <CopyIcon className="group-data-copied/button:text-success size-full transition-opacity group-data-copied/button:opacity-0" />
            <CheckIcon
              strokeWidth={3}
              className="group-data-copied/button:text-success absolute top-0 left-0 size-full -rotate-90 opacity-0 transition-opacity group-data-copied/button:opacity-100"
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
