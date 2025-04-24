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

export type TToken<T> = {
  value: string;
  Icon?: FC<{ className?: string }>;
  object: T;
};

type TTokenProps<T> = TTokensEnabledProps<T> | TTokensDisabledProps;

export type TTextareaWithTokensProps<T> = TextareaAutosizeProps &
  RefAttributes<HTMLTextAreaElement> &
  VariantProps<typeof variants> & {
    classNameTextarea?: string;
    classNameDropdownContent?: string;
    classNameDropdownButton?: string;
  } & TTokenProps<T>;

type TFuseItem<T> = TToken<T> & {
  fuseSearchValue: string;
};

export default function TextareaWithTokens<T>({
  variant,
  fadeOnDisabled,
  className,
  classNameTextarea,
  classNameDropdownContent,
  classNameDropdownButton,
  tokensDisabled,
  tokenPrefix,
  tokenSuffix,
  tokens,
  tokensErrorMessage,
  tokensNoneAvailableMessage,
  tokensNoMatchingMessage,
  dropdownButtonText,
  DropdownButtonIcon,
  value,
  onChange,
  ...props
}: TTextareaWithTokensProps<T>) {
  const [textareaValue, setTextareaValue] = useState(value as string);
  const [search, setSearch] = useState("");
  const [selectedCommandValue, setSelectedCommandValue] = useState("");
  const [open, setOpen] = useState(false);

  const fuse = useMemo(() => {
    if (tokensDisabled) return null;
    if (!tokens) return null;
    return new Fuse<TFuseItem<T>>(
      tokens.map((t) => ({
        ...t,
        fuseSearchValue: t.value.slice(tokenPrefix.length).slice(0, -tokenSuffix.length),
      })),
      { keys: ["fuseSearchValue"] },
    );
  }, [tokens, tokenPrefix?.length, tokenSuffix?.length, tokensDisabled]);

  const [filteredItems, setFilteredItems] = useState(
    tokens ? tokens.sort(tokensDefaultSort) : undefined,
  );
  const textParts: TSplitItem<T>[] = useMemo(
    () => (tokens ? splitByTokens(textareaValue, tokens) : [{ value: textareaValue, token: null }]),
    [textareaValue, tokens],
  );

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const commandRef = useRef<HTMLDivElement>(null);
  const trigger = !tokensDisabled ? tokenPrefix.slice(0, 1) : "";

  const hotkeyRef = useHotkeys(
    "arrowup,arrowdown,enter",
    (e, key) => {
      if (!open) return;

      if (key.keys?.length !== 1) return;
      if (!tokens) return;
      if (!filteredItems) return;

      e.preventDefault();

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
        const selectedIndex = filteredItems.map((i) => i.value).indexOf(selectedCommandValue);
        if (selectedIndex < 0) return;
        const newIndex = Math.max(selectedIndex - 1, 0);
        const newValue = filteredItems[newIndex];
        setSelectedCommandValue(newValue.value);

        const dataValue = newValue.value;
        const commandItem = commandRef.current?.querySelector(
          `[data-value="${dataValue}"]`,
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
        const selectedIndex = filteredItems.map((i) => i.value).indexOf(selectedCommandValue);
        if (selectedIndex < 0) return;
        const newIndex = Math.min(selectedIndex + 1, filteredItems.length - 1);
        const newValue = filteredItems[newIndex];

        setSelectedCommandValue(newValue.value);

        const dataValue = newValue.value;
        const commandItem = commandRef.current?.querySelector(
          `[data-value="${dataValue}"]`,
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
      enabled: !tokensDisabled,
    },
  );

  const setTextareaValueAndTriggerOnChange = useCallback(
    (valueOrFuncion: string | ((prev: string) => string)) => {
      const textareaPrev = textareaValue;
      setTextareaValue(valueOrFuncion);

      const prevTriggerCount = textareaPrev.split(trigger).length - 1;
      const newTriggerCount = textareaValue.split(trigger).length - 1;
      if (textareaPrev.length > textareaValue.length && prevTriggerCount > newTriggerCount) {
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
      if (textParts[i].token !== null) {
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
      setFilteredItems(tokens.sort((a, b) => a.value.localeCompare(b.value)));
      if (tokens.length > 0) {
        setSelectedCommandValue(tokens[0].value);
      }
      return;
    }

    const filtered: TToken<T>[] =
      fuse?.search<TFuseItem<T>>(search).map((i) => ({
        value: i.item.value,
        Icon: i.item.Icon,
        object: i.item.object,
      })) || tokensDefaultSearch(tokens, search);
    setFilteredItems(filtered);

    if (filtered.length > 0) {
      setSelectedCommandValue(filtered[0].value);
    }
  }, [search, tokens, fuse]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        onClick={(e) => e.preventDefault()}
        asChild
        className={cn(
          "bg-input focus-within:ring-foreground/50 relative overflow-hidden rounded-lg border text-left focus-within:ring-1",
          className,
        )}
      >
        <div className="flex w-full flex-1">
          {/* Input with scroll area */}
          <div className="max-h-35 min-w-0 flex-1 overflow-auto">
            <div className="relative flex min-w-0 flex-1 items-start">
              <div
                aria-hidden="true"
                className={cn(
                  variants({
                    variant,
                    fadeOnDisabled,
                    className: classNameTextarea,
                  }),
                  "pointer-events-none absolute top-0 right-0 bottom-0 left-0 flex h-full w-full overflow-hidden rounded-none border-none bg-transparent",
                )}
              >
                <p className="w-full">
                  {textParts.map((part, index) => (
                    <span
                      data-token={part.token !== null ? true : undefined}
                      key={index}
                      className="data-token:bg-process/10 data-token:ring-process/20 data-token:text-process data-token:rounded-[4px] data-token:ring-1"
                    >
                      {!tokensDisabled && part.token !== null ? (
                        <>
                          <span className="text-process/50">
                            {part.value.slice(0, tokenPrefix.length)}
                          </span>
                          <span>
                            {part.value.slice(
                              tokenPrefix.length,
                              part.value.length - tokenSuffix.length,
                            )}
                          </span>
                          <span className="text-process/50">
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

                  const prevTriggerCount = prev.split(trigger).length - 1;
                  const newTriggerCount = newValue.split(trigger).length - 1;
                  if (prev.length > newValue.length && prevTriggerCount > newTriggerCount) {
                    setOpen(false);
                  }

                  if (onChange) {
                    onChange(e);
                  }
                }}
                minRows={1}
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
          </div>
          {/* Dropdown button */}
          {!tokensDisabled && (DropdownButtonIcon || dropdownButtonText) && (
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
                "text-muted-foreground focus:ring-primary group/button mt-1 mr-1 mb-auto h-8 gap-1 px-2 font-semibold",
                classNameDropdownButton,
              )}
            >
              {DropdownButtonIcon && <DropdownButtonIcon className="size-4" />}
              {dropdownButtonText && (
                <p
                  data-has-icon={DropdownButtonIcon ? true : undefined}
                  className="max-w-full min-w-0 shrink px-0.5 leading-tight data-has-icon:group-data-has-value/button:hidden"
                >
                  {dropdownButtonText}
                </p>
              )}
            </Button>
          )}
        </div>
      </PopoverTrigger>
      {!tokensDisabled && (
        <PopoverContent
          animate={false}
          className={cn(
            "flex h-64 max-h-[min(30rem,var(--radix-popper-available-height))] flex-col overflow-hidden rounded-lg p-0",
            classNameDropdownContent,
          )}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
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
                    <CommandEmpty className="text-muted-foreground flex items-start justify-start gap-2 px-2.5 py-2.25 leading-tight">
                      <SearchIcon className="size-5 shrink-0" />
                      <p className="min-w-0 shrink">
                        {tokens && tokens.length === 0
                          ? tokensNoneAvailableMessage
                          : tokensNoMatchingMessage}
                      </p>
                    </CommandEmpty>
                  )}
                  {tokensErrorMessage && !filteredItems && (
                    <ErrorCard className="rounded-md" message={tokensErrorMessage} />
                  )}
                  {!tokensErrorMessage &&
                    !filteredItems &&
                    placeholderArray.map((_, index) => (
                      <CommandItem disabled className="rounded-md" key={index}>
                        <p className="bg-foreground animate-skeleton max-w-full rounded-md leading-tight">
                          Loading {index}
                        </p>
                      </CommandItem>
                    ))}
                  {filteredItems &&
                    filteredItems.map((i, index) => (
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
                        className="items-start rounded-md"
                        key={i.value + index}
                        value={i.value}
                      >
                        {i.Icon && <i.Icon className="size-5 shrink-0" />}
                        <p className="min-w-0 shrink leading-tight">
                          <span className="text-muted-more-foreground">
                            {i.value.slice(0, tokenPrefix.length)}
                          </span>
                          <span>
                            {i.value.slice(tokenPrefix.length, i.value.length - tokenSuffix.length)}
                          </span>
                          <span className="text-muted-more-foreground">
                            {i.value.slice(i.value.length - tokenSuffix.length, i.value.length)}
                          </span>
                        </p>
                      </CommandItem>
                    ))}
                </CommandGroup>
              </CommandList>
            </ScrollArea>
          </Command>
        </PopoverContent>
      )}
    </Popover>
  );
}

export type TSplitItem<T> = {
  value: string;
  token: TToken<T> | null;
};

export function splitByTokens<T>(str: string, tokens: TToken<T>[]): TSplitItem<T>[] {
  if (!tokens.length || !str) {
    return [{ value: str, token: null }];
  }

  const sortedTokens = [...tokens].sort((a, b) => b.value.length - a.value.length);
  let result: TSplitItem<T>[] = [{ value: str, token: null }];

  for (const token of sortedTokens) {
    const newResult: TSplitItem<T>[] = [];
    for (const part of result) {
      if (part.token !== null) {
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

function splitByToken<T>(str: string, token: TToken<T>): TSplitItem<T>[] {
  if (!str.includes(token.value)) {
    return [{ value: str, token: null }];
  }

  const result: TSplitItem<T>[] = [];
  let startIndex = 0;
  let tokenIndex;

  while ((tokenIndex = str.indexOf(token.value, startIndex)) !== -1) {
    if (tokenIndex > startIndex) {
      result.push({
        value: str.substring(startIndex, tokenIndex),
        token: null,
      });
    }

    result.push({
      value: token.value,
      token,
    });

    startIndex = tokenIndex + token.value.length;
  }

  if (startIndex < str.length) {
    result.push({
      value: str.substring(startIndex),
      token: null,
    });
  }

  return result;
}

function getBeforeAndAfterCursor<T>({
  input,
  value,
  trigger,
  tokens,
}: {
  input: HTMLTextAreaElement;
  value: string;
  trigger: string;
  tokens: TToken<T>[];
}) {
  const cursorPosition = input.selectionStart;
  const beforeCursor = value.slice(0, cursorPosition);
  const afterCursor = value.slice(cursorPosition);

  const parts = splitByTokens(beforeCursor, tokens);
  const lastTokenPartsIndex = parts.findLastIndex((part) => part.token !== null);
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

function tokensDefaultSort<T>(a: TToken<T>, b: TToken<T>) {
  return a.value.localeCompare(b.value);
}

function tokensDefaultSearch<T>(tokens: TToken<T>[], search: string) {
  return tokens
    .filter(
      (token) =>
        token.value.toLowerCase().includes(search.toLowerCase()) ||
        search.toLowerCase().includes(token.value.toLowerCase()),
    )
    .sort(tokensDefaultSort);
}

type TTokensEnabledProps<T> = {
  tokenPrefix: string;
  tokenSuffix: string;
  tokens: TToken<T>[] | undefined;
  tokensNoneAvailableMessage: string;
  tokensNoMatchingMessage: string;
  tokensErrorMessage: string | null;
  dropdownButtonText?: string;
  DropdownButtonIcon?: FC<{ className?: string }>;
  tokensDisabled?: never;
};

type TTokensDisabledProps = {
  tokenPrefix?: never;
  tokenSuffix?: never;
  tokens?: never;
  tokensNoneAvailableMessage?: never;
  tokensNoMatchingMessage?: never;
  tokensErrorMessage?: never;
  dropdownButtonText?: never;
  DropdownButtonIcon?: never;
  tokensDisabled: true;
};
