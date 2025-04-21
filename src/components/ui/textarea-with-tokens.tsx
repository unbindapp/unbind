import ErrorCard from "@/components/error-card";
import { Button } from "@/components/ui/button";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/utils";
import { cva, VariantProps } from "class-variance-authority";
import { CommandEmpty } from "cmdk";
import { SearchIcon } from "lucide-react";
import { FC, RefAttributes, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import TextareaAutosize, { TextareaAutosizeProps } from "react-textarea-autosize";
import Fuse from "fuse.js";

const variants = cva(
  "flex px-3 font-medium placeholder:font-medium border-border placeholder:text-foreground/50 py-2.5 leading-tight w-full rounded-lg border transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground/75 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary/50 disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        default: "",
      },
      fadeOnDisabled: {
        default: "disabled:opacity-50",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      fadeOnDisabled: "default",
    },
  },
);

const placeholderArray = Array.from({ length: 10 }, (_, index) => index);

export type TTextareaWithTokensProps = TextareaAutosizeProps &
  RefAttributes<HTMLTextAreaElement> &
  VariantProps<typeof variants> & {
    classNameTextarea?: string;
    classNameDropdownContent?: string;
    classNameDropdownButton?: string;
    tokenPrefix: string;
    tokenSuffix: string;
    tokens: string[] | undefined;
    tokensErrorMessage: string | null;
    dropdownButtonText?: string;
    DropdownButtonIcon?: FC<{ className?: string }>;
  };

export default function TextareaWithTokens({
  variant,
  fadeOnDisabled,
  className,
  classNameTextarea,
  classNameDropdownContent,
  classNameDropdownButton,
  tokenPrefix,
  tokenSuffix,
  tokens,
  tokensErrorMessage,
  dropdownButtonText,
  DropdownButtonIcon,
  value,
  onChange,
  ...props
}: TTextareaWithTokensProps) {
  const [textareaValue, setTextareaValue] = useState(value as string);
  const [search, setSearch] = useState("");
  const [selectedCommandValue, setSelectedCommandValue] = useState("");
  const [open, setOpen] = useState(false);

  const fuse = useMemo(() => {
    if (!tokens) return null;
    return new Fuse(
      tokens.map((i) => ({ name: i })),
      { keys: ["name"] },
    );
  }, [tokens]);

  const [filteredItems, setFilteredItems] = useState(
    tokens ? tokens.sort(tokensDefaultSort) : undefined,
  );
  const textParts = useMemo(
    () =>
      tokens ? splitByTokens(textareaValue, tokens) : [{ value: textareaValue, isToken: false }],
    [textareaValue, tokens],
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const commandRef = useRef<HTMLDivElement>(null);
  const trigger = tokenPrefix.slice(0, 1);

  const hotkeyRef = useHotkeys(
    "arrowup,arrowdown,enter",
    (e, key) => {
      e.preventDefault();

      if (key.keys?.length !== 1) return;
      if (!tokens) return;
      if (!filteredItems) return;

      if (key.keys[0] === "enter") {
        if (!open) return;
        const input = e.currentTarget as HTMLTextAreaElement;
        if (!input) return;

        const { beforeCursor, afterCursor } = getBeforeAndAfterCursor({
          input,
          value: textareaValue,
          trigger,
          tokens,
        });

        if (selectedCommandValue) {
          setTextareaValueAndTriggerOnChange(
            `${beforeCursor}${selectedCommandValue}${afterCursor}`,
          );
          setOpen(false);
        }
        return;
      }

      if (key.keys[0] === "up") {
        const selectedIndex = filteredItems.indexOf(selectedCommandValue);
        if (selectedIndex < 0) return;
        const newIndex = Math.max(selectedIndex - 1, 0);
        const newValue = filteredItems[newIndex];
        setSelectedCommandValue(newValue);

        const commandItem = commandRef.current?.querySelector(
          `[data-value="${newValue}"]`,
        ) as HTMLDivElement;
        if (commandItem) {
          commandItem.scrollIntoView({
            block: "nearest",
            inline: "nearest",
          });
        }
        return;
      }

      if (key.keys[0] === "down") {
        const selectedIndex = filteredItems.indexOf(selectedCommandValue);
        if (selectedIndex < 0) return;
        const newIndex = Math.min(selectedIndex + 1, filteredItems.length - 1);
        const newValue = filteredItems[newIndex];

        setSelectedCommandValue(newValue);
        const commandItem = commandRef.current?.querySelector(
          `[data-value="${newValue}"]`,
        ) as HTMLDivElement;
        if (commandItem) {
          commandItem.scrollIntoView({
            block: "nearest",
            inline: "nearest",
          });
        }
        return;
      }
    },
    {
      enableOnFormTags: true,
    },
  );

  const setTextareaValueAndTriggerOnChange = useCallback(
    (valueOrFuncion: string | ((prev: string) => string)) => {
      const textareaPrev = textareaValue;
      setTextareaValue(valueOrFuncion);
      if (
        textareaPrev.length > textareaValue.length &&
        textareaPrev.endsWith(trigger) &&
        !textareaValue.endsWith(trigger)
      ) {
        setOpen(false);
      }
      if (onChange) {
        const value =
          typeof valueOrFuncion === "function" ? valueOrFuncion(textareaValue) : valueOrFuncion;
        const e = {
          target: { value },
        } as React.ChangeEvent<HTMLTextAreaElement>;
        onChange(e);
      }
    },
    [onChange, textareaValue, trigger],
  );

  // Synchronizes the textarea value with the value prop
  useEffect(() => {
    setTextareaValueAndTriggerOnChange(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Controls the opening of the popover
  useEffect(() => {
    const cursorPosition = textareaRef.current?.selectionStart;
    if (cursorPosition === undefined) return;
    if (cursorPosition !== textareaValue.length) return;
    if (textareaValue.length < 1) return;

    const lastCharacter = textareaValue[cursorPosition - 1];
    if (lastCharacter === trigger) {
      setOpen(true);
    }
  }, [textareaValue, trigger]);

  // Controls the search value
  useEffect(() => {
    let lastTokenIndex = -1;
    for (let i = textParts.length - 1; i >= 0; i--) {
      if (textParts[i].isToken) {
        lastTokenIndex = i;
        break;
      }
    }
    if (lastTokenIndex === -1) {
      const lastTriggerIndex = textareaValue.lastIndexOf(trigger);
      const search = textareaValue.slice(lastTriggerIndex + 1);
      setSearch(search);
    } else {
      const text = textParts
        .slice(lastTokenIndex + 1)
        .map((part) => part.value)
        .join("");
      const lastTriggerIndex = text.lastIndexOf(trigger);
      const search = text.slice(lastTriggerIndex + 1);
      setSearch(search);
    }
  }, [textareaValue, textParts, trigger]);

  // Controls the filtered items based on the search value
  useEffect(() => {
    if (!tokens) return;

    if (!search.trim()) {
      setFilteredItems(tokens.sort((a, b) => a.localeCompare(b)));
      if (tokens.length > 0) {
        setSelectedCommandValue(tokens[0]);
      }
      return;
    }

    const filtered =
      fuse?.search({ name: search }).map((i) => i.item.name) || tokensDefaultSearch(tokens, search);
    setFilteredItems(filtered);

    if (filtered.length > 0) {
      setSelectedCommandValue(filtered[0]);
    }
  }, [search, tokens, fuse]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        onClick={(e) => e.preventDefault()}
        asChild
        className={cn(
          "bg-input focus-within:ring-foreground/50 relative rounded-lg border text-left focus-within:ring-1",
          className,
        )}
      >
        <div className="flex w-full flex-1">
          <div className="relative flex min-w-0 flex-1 items-start">
            <div
              aria-hidden="true"
              className={cn(
                variants({
                  variant,
                  fadeOnDisabled,
                  className: classNameTextarea,
                }),
                "pointer-events-none absolute top-0 right-0 bottom-0 left-0 flex h-full w-full overflow-hidden border-none bg-transparent",
              )}
            >
              <p className="w-full">
                {textParts.map((part, index) => (
                  <span
                    data-token={part.isToken ? true : undefined}
                    key={index}
                    className="data-token:bg-success/8 data-token:ring-success/24 data-token:text-success data-token:rounded-[4px] data-token:ring-1"
                  >
                    {part.isToken ? (
                      <>
                        <span className="text-success/50">
                          {part.value.slice(0, tokenPrefix.length)}
                        </span>
                        <span>
                          {part.value.slice(
                            tokenPrefix.length,
                            part.value.length - tokenSuffix.length,
                          )}
                        </span>
                        <span className="text-success/50">
                          {part.value.slice(
                            part.value.length - tokenSuffix.length,
                            part.value.length,
                          )}
                        </span>
                      </>
                    ) : (
                      part.value
                    )}
                  </span>
                ))}
              </p>
            </div>
            <TextareaAutosize
              ref={(el) => {
                textareaRef.current = el;
                hotkeyRef(el);
              }}
              value={textareaValue}
              onChange={(e) => {
                const prev = textareaValue;
                const newValue = e.target.value;
                setTextareaValue(newValue);
                if (
                  prev.length > newValue.length &&
                  prev.endsWith(trigger) &&
                  !newValue.endsWith(trigger)
                ) {
                  setOpen(false);
                }
                if (onChange) {
                  onChange(e);
                }
              }}
              minRows={1}
              maxRows={10}
              className={cn(
                variants({
                  variant,
                  fadeOnDisabled,
                  className: classNameTextarea,
                }),
                "caret-foreground relative border-none border-transparent bg-transparent text-transparent focus-visible:ring-0 focus-visible:ring-transparent",
              )}
              {...props}
            />
          </div>
          {(DropdownButtonIcon || dropdownButtonText) && (
            <Button
              data-has-value={textareaValue ? true : undefined}
              size="sm"
              variant="outline"
              onClick={() => {
                const newOpen = !open;
                setOpen((prev) => !prev);
                if (newOpen) {
                  setTextareaValueAndTriggerOnChange((prev) => `${prev}${trigger}`);
                }
                textareaRef.current?.focus();
              }}
              className={cn(
                "text-muted-foreground group/button mt-1 mr-1 mb-auto h-8 px-2 font-semibold",
                classNameDropdownButton,
              )}
            >
              {DropdownButtonIcon && <DropdownButtonIcon className="size-4" />}
              {dropdownButtonText && (
                <p className="max-w-full min-w-0 shrink pr-0.5 leading-tight group-data-has-value/button:hidden">
                  {dropdownButtonText}
                </p>
              )}
            </Button>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          "flex h-64 max-h-[min(30rem,var(--radix-popper-available-height))] flex-col overflow-hidden rounded-lg p-0",
          classNameDropdownContent,
        )}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          e.preventDefault();
          setOpen(false);
          requestAnimationFrame(() => textareaRef.current?.focus());
        }}
      >
        <Command
          ref={commandRef}
          value={selectedCommandValue}
          onValueChange={setSelectedCommandValue}
          variant="default"
          className="flex flex-1 flex-col rounded-none border-none bg-transparent shadow-none"
          shouldFilter={false}
        >
          <ScrollArea className="flex flex-1 flex-col">
            <CommandList>
              <CommandGroup>
                {filteredItems && filteredItems.length === 0 && (
                  <CommandEmpty className="text-muted-foreground flex items-start justify-start gap-2 px-3 py-2.25 leading-tight">
                    <SearchIcon className="mt-0.5 -ml-0.5 inline-block size-4 shrink-0" />
                    <p className="min-w-0 shrink">No matching items</p>
                  </CommandEmpty>
                )}
                {tokensErrorMessage && !filteredItems && (
                  <ErrorCard className="rounded-md" message={tokensErrorMessage} />
                )}
                {!tokensErrorMessage &&
                  !filteredItems &&
                  placeholderArray.map((_, index) => (
                    <CommandItem disabled className="rounded-md py-2.25" key={index}>
                      <p className="bg-foreground animate-skeleton max-w-full rounded-md leading-tight">
                        Loading {index}
                      </p>
                    </CommandItem>
                  ))}
                {filteredItems &&
                  filteredItems.map((i) => (
                    <CommandItem
                      onSelect={(v) => {
                        const input = textareaRef.current;
                        if (!input) return;
                        if (!tokens) return;

                        const { beforeCursor, afterCursor } = getBeforeAndAfterCursor({
                          input,
                          value: textareaValue,
                          trigger,
                          tokens,
                        });

                        const newValue = `${beforeCursor}${v}${afterCursor}`;
                        setTextareaValueAndTriggerOnChange(newValue);
                        setOpen(false);
                        requestAnimationFrame(() => {
                          input.focus();
                          input.setSelectionRange(newValue.length, newValue.length);
                        });
                      }}
                      className="rounded-md py-2.25"
                      key={i}
                      value={i}
                    >
                      <p className="w-full leading-tight">
                        <span className="text-muted-more-foreground">
                          {i.slice(0, tokenPrefix.length)}
                        </span>
                        <span>{i.slice(tokenPrefix.length, i.length - tokenSuffix.length)}</span>
                        <span className="text-muted-more-foreground">
                          {i.slice(i.length - tokenSuffix.length, i.length)}
                        </span>
                      </p>
                    </CommandItem>
                  ))}
              </CommandGroup>
            </CommandList>
          </ScrollArea>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function splitByTokens(value: string, tokens: string[]) {
  if (!tokens.length || !value) {
    return [{ value, isToken: false }];
  }

  const sortedTokens = [...tokens].sort((a, b) => b.length - a.length);
  let result = [{ value, isToken: false }];

  for (const token of sortedTokens) {
    const newResult = [];
    for (const part of result) {
      if (part.isToken) {
        newResult.push(part);
        continue;
      }

      const segments = splitByToken(part.value, token);

      for (const segment of segments) {
        newResult.push(segment);
      }
    }

    result = newResult;
  }

  return result;
}

function splitByToken(str: string, token: string) {
  if (!str.includes(token)) {
    return [{ value: str, isToken: false, startIndex: 0, endIndex: str.length }];
  }

  const result = [];
  let startIndex = 0;
  let tokenIndex;

  while ((tokenIndex = str.indexOf(token, startIndex)) !== -1) {
    if (tokenIndex > startIndex) {
      result.push({
        value: str.substring(startIndex, tokenIndex),
        isToken: false,
      });
    }

    result.push({
      value: token,
      isToken: true,
    });

    startIndex = tokenIndex + token.length;
  }

  if (startIndex < str.length) {
    result.push({
      value: str.substring(startIndex),
      isToken: false,
    });
  }

  return result;
}

function getBeforeAndAfterCursor({
  input,
  value,
  trigger,
  tokens,
}: {
  input: HTMLTextAreaElement;
  value: string;
  trigger: string;
  tokens: string[];
}) {
  const cursorPosition = input.selectionStart;
  const beforeCursor = value.slice(0, cursorPosition);
  const afterCursor = value.slice(cursorPosition);

  const parts = splitByTokens(beforeCursor, tokens);
  const lastTokenPartsIndex = parts.findLastIndex((part) => part.isToken);
  let lastTokenEndIndex = 0;
  if (lastTokenPartsIndex > -1) {
    for (let i = 0; i <= lastTokenPartsIndex; i++) {
      lastTokenEndIndex += parts[i].value.length;
    }
  }

  const beforeFirstPart = beforeCursor.slice(0, lastTokenEndIndex);
  const beforeSecondPart = beforeCursor.slice(lastTokenEndIndex);

  const closestTriggerIndex = beforeSecondPart.lastIndexOf(trigger);
  const beforeSecondPartEdited = beforeSecondPart.slice(
    0,
    closestTriggerIndex === -1 ? beforeSecondPart.length : closestTriggerIndex,
  );

  return {
    beforeCursor: `${beforeFirstPart}${beforeSecondPartEdited}`,
    afterCursor,
  };
}

function tokensDefaultSort(a: string, b: string) {
  return a.localeCompare(b);
}

function tokensDefaultSearch(tokens: string[], search: string) {
  return tokens
    .filter(
      (token: string) =>
        token.toLowerCase().includes(search.toLowerCase()) ||
        search.toLowerCase().includes(token.toLowerCase()),
    )
    .sort(tokensDefaultSort);
}
