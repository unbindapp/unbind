import ErrorCard from "@/components/error-card";
import {
  Combobox,
  ComboboxChip,
  ComboboxChipRemove,
  ComboboxChips,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { cn } from "@/components/ui/utils";
import { gitWatchPathSuggestionsQuery } from "@/lib/queries/git";
import { TServiceShallow } from "@/lib/queries/services";
import { splitWatchPaths } from "@/lib/watch-paths";
import { useQuery } from "@tanstack/react-query";
import { FolderSearchIcon, PlusIcon, XIcon } from "lucide-react";
import { useMemo, useState } from "react";

const maxVisibleSuggestions = 100;
const placeholderArray = Array.from({ length: 10 }, (_, index) => index);
const placeholder = "Add pattern, e.g. /apps/web/**";

type TAddItem = { add: string[] };
type TItem = string | TAddItem;

function isAddItem(item: TItem): item is TAddItem {
  return typeof item !== "string";
}

type TProps = {
  service: TServiceShallow;
  value: string[];
  serverValue: string[];
  onChange: (value: string[]) => void;
  className?: string;
};

export default function WatchPathsInput({
  service,
  value,
  serverValue,
  onChange,
  className,
}: TProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const typed = useMemo(() => splitWatchPaths(inputValue), [inputValue]);

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

  const items = useMemo(() => {
    const list: TItem[] = [];
    if (typed.length > 0) list.push({ add: typed });
    if (!suggestions) return list;
    const query = inputValue.trim().toLowerCase();
    let shown = 0;
    for (const suggestion of suggestions) {
      if (shown >= maxVisibleSuggestions) break;
      if (value.includes(suggestion)) continue;
      if (query && !suggestion.toLowerCase().includes(query)) continue;
      list.push(suggestion);
      shown++;
    }
    return list;
  }, [suggestions, value, inputValue, typed]);

  const hasRemovedPatterns = serverValue.some((pattern) => !value.includes(pattern));

  const add = (patterns: string[]) => {
    const added = patterns.filter((pattern) => !value.includes(pattern));
    setInputValue("");
    if (added.length > 0) onChange([...value, ...added]);
  };

  return (
    <Combobox<TItem, true>
      multiple
      items={items}
      filter={null}
      value={value}
      onValueChange={(next) => {
        const addItem = next.find(isAddItem);
        if (addItem) {
          add(addItem.add);
          return;
        }
        if (next.length > value.length) {
          add(next.filter((item) => !value.includes(item as string)) as string[]);
          return;
        }
        onChange(next as string[]);
      }}
      inputValue={inputValue}
      onInputValueChange={setInputValue}
      open={isOpen}
      onOpenChange={(open, details) => {
        if (!open && details.reason === "item-press") {
          details.cancel();
          return;
        }
        if (!open && details.reason === "escape-key") setInputValue("");
        if (open) setHasOpened(true);
        setIsOpen(open);
      }}
      autoHighlight
      itemToStringLabel={(item) => (isAddItem(item) ? item.add.join(", ") : item)}
    >
      <div className={cn("flex w-full flex-col gap-2", className)}>
        {value.length > 0 && (
          <ComboboxChips>
            {value.map((pattern) => (
              <ComboboxChip
                key={pattern}
                aria-label={pattern}
                data-staged={!serverValue.includes(pattern) || undefined}
                className="bg-input"
              >
                <span className="min-w-0 truncate px-2.5 py-1.5 font-mono text-sm leading-tight font-medium">
                  {pattern}
                </span>
                <ComboboxChipRemove aria-label={`Remove ${pattern}`}>
                  <XIcon className="size-4" />
                </ComboboxChipRemove>
              </ComboboxChip>
            ))}
          </ComboboxChips>
        )}
        <ComboboxInput
          placeholder={placeholder}
          data-staged={hasRemovedPatterns || undefined}
          className="data-staged:text-change data-staged:bg-change/2-10 data-staged:border-change/5-10 data-staged:placeholder:text-change/8-10"
        />
      </div>
      <ComboboxContent className="h-68" collisionAvoidance={{ side: "none" }}>
        {!suggestions && isPending && (
          <div className="flex flex-col p-1">
            {placeholderArray.map((_, index) => (
              <div key={index} className="flex items-center px-2.5 py-2.5">
                <p className="bg-foreground animate-skeleton min-w-0 shrink rounded-md leading-tight">
                  Loading
                </p>
              </div>
            ))}
          </div>
        )}
        {!suggestions && !isPending && error && (
          <div className="p-1">
            <ErrorCard className="rounded-md" message={error.message} />
          </div>
        )}
        {suggestions && (
          <>
            <ComboboxEmpty>
              <FolderSearchIcon className="size-4.5 shrink-0" />
              <p className="min-w-0 shrink">No suggestions</p>
            </ComboboxEmpty>
            <ComboboxList>
              {(item: TItem) =>
                isAddItem(item) ? (
                  <ComboboxItem key="add" value={item}>
                    <PlusIcon className="-ml-0.5 size-4.5 shrink-0" />
                    <p className="flex min-w-0 flex-wrap items-center gap-1.5 leading-tight">
                      <span>Add</span>
                      {item.add.map((pattern) => (
                        <span
                          key={pattern}
                          className="bg-foreground/2-10 border-foreground/2-10 -my-1 max-w-full min-w-0 rounded-sm border px-1.25 font-mono text-sm font-normal break-all"
                        >
                          {pattern}
                        </span>
                      ))}
                    </p>
                  </ComboboxItem>
                ) : (
                  <ComboboxItem key={item} value={item}>
                    <p className="min-w-0 shrink font-mono leading-tight break-all">{item}</p>
                  </ComboboxItem>
                )
              }
            </ComboboxList>
          </>
        )}
      </ComboboxContent>
    </Combobox>
  );
}
