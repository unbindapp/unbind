import ErrorCard from "@/components/error-card";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/utils";
import { splitWatchPaths } from "@/lib/watch-paths";
import { FolderSearchIcon, PlusIcon, XIcon } from "lucide-react";
import { useMemo, useRef, useState } from "react";

const maxVisibleSuggestions = 100;
const placeholderArray = Array.from({ length: 8 }, (_, index) => index);

type TProps = {
  value: string[];
  onChange: (value: string[]) => void;
  suggestions: string[] | undefined;
  isPending: boolean;
  error: string | undefined;
  isTruncated: boolean;
  onOpen: () => void;
  className?: string;
};

export default function WatchPathsInput({
  value,
  onChange,
  suggestions,
  isPending,
  error,
  isTruncated,
  onOpen,
  className,
}: TProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typed = inputValue.trim();

  const visibleSuggestions = useMemo(() => {
    if (!suggestions) return undefined;
    const query = typed.toLowerCase();
    const visible: string[] = [];
    for (const suggestion of suggestions) {
      if (value.includes(suggestion)) continue;
      if (query && !suggestion.toLowerCase().includes(query)) continue;
      visible.push(suggestion);
      if (visible.length >= maxVisibleSuggestions) break;
    }
    return visible;
  }, [suggestions, value, typed]);

  const add = (raw: string) => {
    inputRef.current?.focus();
    const added = splitWatchPaths(raw).filter((pattern) => !value.includes(pattern));
    if (added.length === 0) return;
    onChange([...value, ...added]);
  };

  const remove = (pattern: string) => onChange(value.filter((p) => p !== pattern));

  const commitTyped = () => {
    if (!typed) return;
    add(typed);
    setInputValue("");
  };

  return (
    <div className={cn("flex w-full flex-col gap-2", className)}>
      {value.length > 0 && (
        <ul className="flex w-full flex-wrap gap-1.5">
          {value.map((pattern) => (
            <li
              key={pattern}
              className="bg-background flex max-w-full min-w-0 items-stretch overflow-hidden rounded-lg border"
            >
              <span className="min-w-0 truncate px-3 py-2 font-mono text-sm leading-tight font-medium">
                {pattern}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                forceMinSize={false}
                aria-label={`Remove ${pattern}`}
                onClick={() => remove(pattern)}
                className="text-muted-foreground size-auto rounded-none border-l px-2"
              >
                <XIcon className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Popover
        open={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open);
          if (open) {
            onOpen();
            return;
          }
          commitTyped();
        }}
      >
        <Command
          shouldFilter={false}
          wrapper="none"
          className="flex flex-1 flex-col overflow-visible"
        >
          <PopoverTrigger
            render={
              <Button
                variant="outline"
                forceMinSize={false}
                data-placeholder
                className="bg-input focus-visible:ring-primary/8-10 has-hover:hover:bg-input has-hover:hover:data-placeholder:text-muted-foreground/9-10 data-placeholder:text-muted-foreground/9-10 cursor-text justify-start px-3 text-left font-medium focus-visible:ring-1 focus-visible:ring-offset-0"
              >
                Add pattern, e.g. apps/web/**
              </Button>
            }
          />
          <PopoverContent
            animate={false}
            autoFocus={false}
            sideOffset={-42}
            className="group/content flex h-68 max-h-[min(30rem,var(--available-height))] overflow-visible border-none bg-transparent p-0 shadow-none"
          >
            <div className="flex w-full flex-col gap-1">
              <CommandInput
                ref={inputRef}
                showSpinner={isPending}
                placeholder="Add pattern, e.g. apps/web/**"
                value={inputValue}
                onValueChange={(v) => {
                  setInputValue(v);
                  requestAnimationFrame(() => {
                    scrollAreaRef.current?.scrollTo({ top: 0 });
                  });
                }}
                className="bg-input focus-visible:ring-primary/8-10 placeholder:text-muted-foreground/9-10 rounded-lg border px-3 py-2.5 font-medium focus-visible:ring-1"
                classNameWrapper="border-none"
                hideIcon
              />
              <div className="bg-popover shadow-shadow-color/shadow-opacity flex w-full flex-1 flex-col overflow-hidden rounded-lg border shadow-lg group-data-[side=top]/content:order-first">
                <ScrollArea viewportRef={scrollAreaRef} className="flex flex-1 flex-col">
                  <CommandList>
                    <CommandGroup>
                      {typed && (
                        <CommandItem
                          value={`add:${typed}`}
                          onSelect={commitTyped}
                          className="group/item px-3"
                        >
                          <PlusIcon className="-ml-0.5 size-4.5 shrink-0" />
                          <p className="min-w-0 shrink leading-tight">
                            Add <span className="font-mono">{typed}</span>
                          </p>
                        </CommandItem>
                      )}
                      {!visibleSuggestions &&
                        isPending &&
                        placeholderArray.map((_, index) => (
                          <CommandItem disabled key={index}>
                            <p className="bg-foreground animate-skeleton min-w-0 shrink rounded-md leading-tight">
                              Loading
                            </p>
                          </CommandItem>
                        ))}
                      {!visibleSuggestions && !isPending && error && (
                        <ErrorCard className="rounded-md" message={error} />
                      )}
                      {visibleSuggestions && visibleSuggestions.length === 0 && !typed && (
                        <div className="text-muted-foreground flex items-center justify-start gap-2 px-2.5 py-2.5 leading-tight">
                          <FolderSearchIcon className="size-4.5 shrink-0" />
                          <p className="min-w-0 shrink">No suggestions</p>
                        </div>
                      )}
                      {visibleSuggestions?.map((suggestion) => (
                        <CommandItem
                          key={suggestion}
                          value={suggestion}
                          onSelect={() => add(suggestion)}
                          className="group/item px-3"
                        >
                          <p className="min-w-0 shrink font-mono leading-tight">{suggestion}</p>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </ScrollArea>
              </div>
            </div>
          </PopoverContent>
        </Command>
      </Popover>
      {isTruncated && (
        <p className="text-muted-foreground px-1 text-sm leading-tight">
          The repository is too large to list every path, suggestions are incomplete.
        </p>
      )}
    </div>
  );
}
