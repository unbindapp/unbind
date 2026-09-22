import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { Dialog } from "@base-ui/react/dialog";
import { useSearchContext } from "fumadocs-ui/contexts/search";
import type {
  FullSearchTriggerProps,
  SearchTriggerProps,
} from "fumadocs-ui/layouts/shared/slots/search-trigger";
import { SearchIcon } from "lucide-react";

export function SearchTrigger({
  className,
  hideIfDisabled: _hideIfDisabled,
  size: _size,
  color: _color,
  variant: _variant,
  ...props
}: SearchTriggerProps) {
  const { dialogHandle } = useSearchContext();

  return (
    <Dialog.Trigger
      handle={dialogHandle}
      render={<Button type="button" variant="ghost" size="icon" />}
      aria-label="Open search"
      className={cn("text-muted-foreground", className)}
      {...props}
    >
      <SearchIcon className="size-5" />
    </Dialog.Trigger>
  );
}

export function FullSearchTrigger({
  className,
  hideIfDisabled: _hideIfDisabled,
  ...props
}: FullSearchTriggerProps) {
  const { dialogHandle, hotKey } = useSearchContext();

  return (
    <Dialog.Trigger
      handle={dialogHandle}
      render={<Button type="button" variant="outline" size="sm" forceMinSize={false} />}
      className={cn(
        "text-muted-foreground/9-10 bg-input w-full justify-start gap-2 rounded-lg px-3 py-2 font-medium",
        className,
      )}
      {...props}
    >
      <SearchIcon className="size-4.5 shrink-0" />
      <span className="min-w-0 flex-1 truncate text-start">Search</span>
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
