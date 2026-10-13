import {
  Combobox,
  ComboboxChip,
  ComboboxChipRemove,
  ComboboxChips,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { cn } from "@/components/ui/utils";
import { PlusIcon, XIcon } from "lucide-react";
import { useMemo, useState } from "react";

const placeholder = "Add header, e.g. Cache-Control: no-store";

type TAddItem = { add: string };
type TItem = string | TAddItem;

function isAddItem(item: TItem): item is TAddItem {
  return typeof item !== "string";
}

type TProps = {
  // "Name: value" lines
  value: string[];
  serverValue: string[];
  onChange: (value: string[]) => void;
  onBlur?: () => void;
  className?: string;
};

export default function ResponseHeadersInput({
  value,
  serverValue,
  onChange,
  onBlur,
  className,
}: TProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const typed = inputValue.trim();

  const items = useMemo((): TItem[] => (typed ? [{ add: typed }] : []), [typed]);
  const hasRemovedHeaders = serverValue.some((line) => !value.includes(line));

  const add = (line: string) => {
    setInputValue("");
    if (!value.includes(line)) onChange([...value, line]);
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
        onChange(next as string[]);
      }}
      inputValue={inputValue}
      onInputValueChange={setInputValue}
      open={isOpen && items.length > 0}
      onOpenChange={(open, details) => {
        if (!open && details.reason === "item-press") {
          details.cancel();
          return;
        }
        if (!open && details.reason === "escape-key") setInputValue("");
        setIsOpen(open);
      }}
      autoHighlight
      itemToStringLabel={(item) => (isAddItem(item) ? item.add : item)}
    >
      <div className={cn("flex w-full flex-col gap-2", className)}>
        {value.length > 0 && (
          <ComboboxChips>
            {value.map((line) => (
              <ComboboxChip
                key={line}
                aria-label={line}
                data-staged={!serverValue.includes(line) || undefined}
                className="bg-input"
              >
                <span className="min-w-0 truncate px-2.5 py-1.5 font-mono text-sm leading-tight font-medium">
                  {line}
                </span>
                <ComboboxChipRemove aria-label={`Remove ${line}`}>
                  <XIcon className="size-4" />
                </ComboboxChipRemove>
              </ComboboxChip>
            ))}
          </ComboboxChips>
        )}
        <ComboboxInput
          placeholder={placeholder}
          onBlur={onBlur}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck="false"
          data-staged={hasRemovedHeaders || undefined}
          className="data-staged:text-change data-staged:bg-change/2-10 data-staged:border-change/5-10 data-staged:placeholder:text-change/8-10"
        />
      </div>
      <ComboboxContent collisionAvoidance={{ side: "none" }}>
        <ComboboxList>
          {(item: TItem) =>
            isAddItem(item) ? (
              <ComboboxItem key="add" value={item}>
                <PlusIcon className="-ml-0.5 size-4.5 shrink-0" />
                <p className="flex min-w-0 flex-wrap items-center gap-1.5 leading-tight">
                  <span>Add</span>
                  <span className="bg-foreground/2-10 border-foreground/2-10 -my-1 max-w-full min-w-0 rounded-sm border px-1.25 font-mono text-sm font-normal break-all">
                    {item.add}
                  </span>
                </p>
              </ComboboxItem>
            ) : null
          }
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
