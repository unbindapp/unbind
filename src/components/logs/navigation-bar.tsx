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
        "absolute right-4 bottom-[calc(1rem+var(--safe-area-inset-bottom))] flex flex-col",
        className,
      )}
    >
      <Button
        disabled={isAtTop}
        data-disabled={isAtTop ? true : undefined}
        fadeOnDisabled={false}
        variant="ghost"
        size="icon"
        onClick={scrollToTop}
        className="bg-background-hover data-disabled:text-muted-more-foreground rounded-lg rounded-b-none border-t border-r border-l"
      >
        <ArrowUpIcon className="size-5" />
      </Button>
      <div className="bg-border pointer-events-none h-px w-full" />
      <Button
        disabled={isAtBottom}
        data-disabled={isAtBottom ? true : undefined}
        fadeOnDisabled={false}
        variant="ghost"
        size="icon"
        onClick={scrollToBottom}
        className="bg-background-hover data-disabled:text-muted-more-foreground rounded-lg rounded-t-none border-r border-b border-l"
      >
        <ArrowDownIcon className="size-5" />
      </Button>
    </div>
  );
}
