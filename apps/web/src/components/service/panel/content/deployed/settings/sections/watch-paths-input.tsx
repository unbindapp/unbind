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
import { gitWatchPathSuggestionsQuery } from "@/lib/queries/git";
import { TServiceShallow } from "@/lib/queries/services";
import { splitWatchPaths } from "@/lib/watch-paths";
import { useQuery } from "@tanstack/react-query";
import { FolderSearchIcon, PlusIcon, XIcon } from "lucide-react";
import { useMemo, useRef, useState } from "react";

const maxVisibleSuggestions = 100;
const placeholderArray = Array.from({ length: 10 }, (_, index) => index);

type TProps = {
  service: TServiceShallow;
  value: string[];
  onChange: (value: string[]) => void;
  className?: string;
};

export default function WatchPathsInput({ service, value, onChange, className }: TProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typed = splitWatchPaths(inputValue);

  const { data, isPending, error } = useQuery({
    ...gitWatchPathSuggestionsQuery({
      installationId: service.github_installation_id ?? 0,
      owner: service.git_repository_owner ?? "",
      repoName: service.git_repository ?? "",
      ref: service.config.git_branch ?? "",
    }),
    enabled: hasOpened,
  });
  const suggestions = data?.suggestions;

  const visibleSuggestions = useMemo(() => {
    if (!suggestions) return undefined;
    const query = inputValue.trim().toLowerCase();
    const visible: string[] = [];
    for (const suggestion of suggestions) {
      if (value.includes(suggestion)) continue;
      if (query && !suggestion.toLowerCase().includes(query)) continue;
      visible.push(suggestion);
      if (visible.length >= maxVisibleSuggestions) break;
    }
    return visible;
  }, [suggestions, value, inputValue]);

  const add = (patterns: string[]) => {
    inputRef.current?.focus();
    setInputValue("");
    const added = patterns.filter((pattern) => !value.includes(pattern));
    if (added.length === 0) return;
    onChange([...value, ...added]);
  };

  const remove = (pattern: string) => onChange(value.filter((p) => p !== pattern));

  const commitTyped = () => {
    if (typed.length === 0) return;
    add(typed);
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
            setHasOpened(true);
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
                Add pattern, e.g. /apps/web/**
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
                placeholder="Add pattern, e.g. /apps/web/**"
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
                      {typed.length > 0 && (
                        <CommandItem
                          value={`add:${inputValue}`}
                          onSelect={commitTyped}
                          className="group/item px-3"
                        >
                          <PlusIcon className="-ml-0.5 size-4.5 shrink-0" />
                          <p className="flex min-w-0 flex-wrap items-center gap-1.5 leading-tight">
                            <span>Add</span>
                            {typed.map((pattern) => (
                              <span
                                key={pattern}
                                className="bg-card border-foreground/2-10 -my-1 max-w-full min-w-0 rounded-sm border px-1.25 font-mono text-sm font-normal break-all"
                              >
                                {pattern}
                              </span>
                            ))}
                          </p>
                        </CommandItem>
                      )}
                      {!suggestions &&
                        isPending &&
                        placeholderArray.map((_, index) => (
                          <CommandItem disabled key={index}>
                            <p className="bg-foreground animate-skeleton min-w-0 shrink rounded-md leading-tight">
                              Loading
                            </p>
                          </CommandItem>
                        ))}
                      {!suggestions && !isPending && error && (
                        <ErrorCard className="rounded-md" message={error.message} />
                      )}
                      {visibleSuggestions &&
                        visibleSuggestions.length === 0 &&
                        typed.length === 0 && (
                          <div className="text-muted-foreground flex items-center justify-start gap-2 px-2.5 py-2.5 leading-tight">
                            <FolderSearchIcon className="size-4.5 shrink-0" />
                            <p className="min-w-0 shrink">No suggestions</p>
                          </div>
                        )}
                      {visibleSuggestions?.map((suggestion) => (
                        <CommandItem
                          key={suggestion}
                          value={suggestion}
                          onSelect={() => add([suggestion])}
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
      {data?.truncated && (
        <p className="text-muted-foreground px-1 text-sm leading-tight">
          The repository is too large to list every path, suggestions are incomplete.
        </p>
      )}
    </div>
  );
}
