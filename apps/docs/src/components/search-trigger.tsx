import { cn } from "@/lib/cn";
import { useSearchContext } from "fumadocs-ui/contexts/search";
import { SearchIcon } from "lucide-react";
import { Dialog } from "@base-ui/react/dialog";
import type {
  SearchTriggerProps,
  FullSearchTriggerProps,
} from "fumadocs-ui/layouts/shared/slots/search-trigger";

export function SearchTrigger({
  className,
  hideIfDisabled,
  size,
  color,
  variant,
  ...props
}: SearchTriggerProps) {
  const { dialogHandle } = useSearchContext();

  return (
    <Dialog.Trigger
      handle={dialogHandle}
      type="button"
      aria-label="Open search"
      className={cn(
        "text-muted-foreground has-hover:hover:bg-border has-hover:hover:text-foreground flex size-9 items-center justify-center rounded-lg transition-colors",
        className,
      )}
      {...props}
    >
      <SearchIcon className="size-5" />
    </Dialog.Trigger>
  );
}

export function FullSearchTrigger({ className, hideIfDisabled, ...props }: FullSearchTriggerProps) {
  const { dialogHandle, hotKey } = useSearchContext();

  return (
    <Dialog.Trigger
      handle={dialogHandle}
      type="button"
      className={cn(
        "bg-input text-muted-foreground/9-10 has-hover:hover:ring-primary/6-10 flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-start font-medium transition-shadow has-hover:hover:ring-1",
        className,
      )}
      {...props}
    >
      <SearchIcon className="size-4.5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">Search</span>
      <span className="text-muted-more-foreground flex shrink-0 items-center gap-0.5 font-mono text-xs">
        {hotKey.map((key, i) => (
          <kbd key={i} className="bg-background rounded-sm border px-1.5 py-0.5">
            {key.display}
          </kbd>
        ))}
      </span>
    </Dialog.Trigger>
  );
}
