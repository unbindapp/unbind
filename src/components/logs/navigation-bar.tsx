import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";

export type NavigationBarProps = {
  isAtBottom: boolean;
  isAtTop: boolean;
  scrollToBottom: () => void;
  scrollToTop: () => void;
};

type Props = { className?: string } & NavigationBarProps;

export default function NavigationBar({
  isAtBottom,
  isAtTop,
  scrollToBottom,
  scrollToTop,
  className,
  ...rest
}: Props) {
  return (
    <div
      {...rest}
      className={cn(
        "absolute flex flex-col right-4 bottom-[calc(1rem+var(--safe-area-inset-bottom))]",
        className
      )}
    >
      <Button
        disabled={isAtTop}
        data-disabled={isAtTop ? true : undefined}
        fadeOnDisabled={false}
        variant="ghost"
        size="icon"
        onClick={scrollToTop}
        className="rounded-lg rounded-b-none bg-background-hover border-t border-l border-r data-disabled:text-muted-more-foreground"
      >
        <ArrowUpIcon className="size-5" />
      </Button>
      <div className="w-full h-px bg-border pointer-events-none" />
      <Button
        disabled={isAtBottom}
        data-disabled={isAtBottom ? true : undefined}
        fadeOnDisabled={false}
        variant="ghost"
        size="icon"
        onClick={scrollToBottom}
        className="rounded-lg rounded-t-none bg-background-hover border-b border-l border-r data-disabled:text-muted-more-foreground"
      >
        <ArrowDownIcon className="size-5" />
      </Button>
    </div>
  );
}
