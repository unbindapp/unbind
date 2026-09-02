import ErrorCard from "@/components/error-card";
import ErrorLine from "@/components/error-line";
import {
  DomainCard,
  TSavedDomainStatus,
} from "@/components/service/panel/content/undeployed/domain-card";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input, InputProps } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider, SliderProps } from "@/components/ui/slider";
import TokenFieldFallback from "@/components/ui/token-field/token-field-fallback";
import type { TTokenFieldProps } from "@/components/ui/token-field/token-field";
import { cn } from "@/components/ui/utils";
import { appLocale } from "@/lib/constants";
import {
  AnyFieldApi,
  AnyFormApi,
  createFormHook,
  createFormHookContexts,
  FormAsyncValidateOrFn,
  FormOptions,
  FormValidateOrFn,
  useStore,
} from "@tanstack/react-form";
import { CheckIcon, RotateCcwIcon } from "lucide-react";
import {
  FC,
  lazy,
  ReactElement,
  Suspense,
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { z } from "zod";

const { fieldContext, formContext } = createFormHookContexts();

// Keyed by the form's store: useForm returns a spread copy of the FormApi,
// so the store is the only object shared by reference with each field's `field.form`
const formDomIds = new WeakMap<AnyFormApi["store"], string>();

function scrollToFirstInvalidField(formDomId: string) {
  requestAnimationFrame(() => {
    const element = document.querySelector<HTMLElement>(
      `[data-form-id="${formDomId}"][data-invalid]`,
    );
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    element
      .querySelector<HTMLElement>("input, textarea, select, button, [tabindex]")
      ?.focus({ preventScroll: true });
  });
}

function useFieldError(field: AnyFieldApi, dontCheckUntilSubmit?: boolean) {
  const submissionAttempts = useStore(field.form.store, (state) => state.submissionAttempts);
  const isFormSubmitted = submissionAttempts > 0;
  const hasError =
    (field.state.meta.isTouched || isFormSubmitted) &&
    (field.state.meta.isBlurred || isFormSubmitted) &&
    (!dontCheckUntilSubmit || isFormSubmitted) &&
    field.state.meta.errors.length > 0;
  return { hasError, formDomId: formDomIds.get(field.form.store) };
}

type TFieldProps = {
  field: AnyFieldApi;
  hideError?: boolean;
  dontCheckUntilSubmit?: boolean;
  classNameInput?: string;
  classNameInfo?: string;
};

type TInputWithInfoProps = TFieldProps & InputProps;

function InputWithInfo({
  className,
  hideError,
  field,
  classNameInput,
  classNameInfo,
  dontCheckUntilSubmit,
  showUndo,
  onUndo,
  Icon,
  classNameIcon,
  ...rest
}: TInputWithInfoProps) {
  const { hasError, formDomId } = useFieldError(field, dontCheckUntilSubmit);
  const ref = useRef<HTMLInputElement>(null);
  const inputRef = rest.ref || ref;
  // The label-included layout renders the icon inside its floating label
  const hasStandaloneIcon = Icon !== undefined && rest.layout !== "label-included";

  return (
    <div
      data-form-id={formDomId}
      data-invalid={hasError || undefined}
      className={cn("relative flex flex-col", className)}
    >
      {hasStandaloneIcon && (
        <Icon
          className={cn("pointer-events-none absolute top-3 left-3.5 size-4.5", classNameIcon)}
        />
      )}
      <Input
        ref={inputRef}
        {...rest}
        Icon={hasStandaloneIcon ? undefined : Icon}
        aria-invalid={hasError || undefined}
        data-show-undo={showUndo || undefined}
        className={cn("w-full data-show-undo:pr-11", hasStandaloneIcon && "pl-10", classNameInput)}
      />
      {showUndo && (
        <Button
          variant="ghost"
          className="absolute top-1 right-1 z-10 size-8.5 rounded-md"
          size="icon"
          onClick={() => {
            onUndo?.();
            ref.current?.focus();
          }}
        >
          <RotateCcwIcon className="size-4.5" />
        </Button>
      )}
      {!hideError && hasError ? (
        <ErrorLine
          className={cn("bg-transparent py-1.5 pl-1.5", classNameInfo)}
          message={field.state.meta.errors[0].message}
        />
      ) : null}
    </div>
  );
}

const TokenFieldLazy = lazy(() => import("@/components/ui/token-field/token-field"));

function TokenField(props: TTokenFieldProps) {
  return (
    <Suspense fallback={<TokenFieldFallback {...props} />}>
      <TokenFieldLazy {...props} />
    </Suspense>
  );
}

function TokenFieldWithInfo({
  className,
  hideError,
  field,
  classNameInput,
  classNameInfo,
  dontCheckUntilSubmit,
  ...rest
}: TTokenFieldProps & TFieldProps) {
  const { hasError, formDomId } = useFieldError(field, dontCheckUntilSubmit);

  if (hideError) {
    return <TokenField {...rest} className={cn("w-full", className, classNameInput)} />;
  }

  return (
    <div
      data-form-id={formDomId}
      data-invalid={hasError || undefined}
      className={cn("flex flex-col", className)}
    >
      <TokenField {...rest} className={cn("w-full", classNameInput)} />
      {hasError ? (
        <ErrorLine
          className={cn("bg-transparent py-1.5 pl-1.5", classNameInfo)}
          message={field.state.meta.errors[0].message}
        />
      ) : null}
    </div>
  );
}

type TDomainInputWithInfoProps = TFieldProps &
  InputProps & {
    autoGeneratedDomain?: string;
    hideCard?: boolean;
    savedStatus?: TSavedDomainStatus;
  };

function DomainInput({
  className,
  hideError,
  field,
  classNameInput,
  classNameInfo,
  dontCheckUntilSubmit,
  autoGeneratedDomain,
  hideCard,
  savedStatus,
  Icon,
  classNameIcon,
  ...rest
}: TDomainInputWithInfoProps) {
  const { hasError, formDomId } = useFieldError(field, dontCheckUntilSubmit);

  const showCardType =
    autoGeneratedDomain !== undefined && field.state.value === autoGeneratedDomain
      ? "auto-generated"
      : "domain-card";

  const showReset = autoGeneratedDomain !== undefined && field.state.value !== autoGeneratedDomain;

  const ref = useRef<HTMLInputElement>(null);

  return (
    <div
      data-form-id={formDomId}
      data-invalid={hasError || undefined}
      className={cn("relative flex flex-col", className)}
    >
      {Icon && (
        <Icon
          className={cn("pointer-events-none absolute top-3 left-3.5 z-11 size-4.5", classNameIcon)}
        />
      )}
      <Input
        ref={ref}
        {...rest}
        aria-invalid={hasError || undefined}
        data-show-reset={showReset || undefined}
        data-show-generated={showCardType === "auto-generated" || undefined}
        className={cn(
          "relative z-10 w-full data-show-generated:pr-22 data-show-reset:pr-11",
          Icon && "pl-10",
          classNameInput,
        )}
      />
      {!rest.disabled && showReset && (
        <Button
          variant="ghost"
          className="absolute top-1 right-1 z-10 size-8.5 rounded-md focus-visible:z-10"
          size="icon"
          onClick={() => {
            field.setValue(autoGeneratedDomain);
            ref.current?.focus();
          }}
        >
          <RotateCcwIcon className="size-4.5" />
        </Button>
      )}
      {!hideCard && !rest.disabled && showCardType === "domain-card" && (
        <DomainCard
          domain={field.state.value}
          savedStatus={savedStatus}
          className="-mt-3 rounded-t-none pt-2.75"
        />
      )}
      {!rest.disabled && showCardType === "auto-generated" && (
        <AutoGeneratedDomainIndicator className="absolute top-4 right-1.25 z-10" />
      )}
      {!hideError && hasError ? (
        <ErrorLine
          className={cn("bg-transparent py-1.5 pl-1.5", classNameInfo)}
          message={field.state.meta.errors[0].message}
        />
      ) : null}
    </div>
  );
}

function AutoGeneratedDomainIndicator({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "text-muted-foreground bg-background pointer-events-none relative flex max-w-1/2 min-w-0 items-center gap-1 rounded-sm border px-1.25 py-0.5",
        className,
      )}
    >
      <p className="min-w-0 shrink truncate text-xs leading-tight font-medium">Generated</p>
    </div>
  );
}

type TSliderWithInfoProps = TFieldProps &
  SliderProps<readonly number[]> & {
    classNameMin?: string;
    classNameMax?: string;
    minMaxFormatter?: (value: number) => string;
    hideMinMax?: boolean;
  };

function StorageSizeInput({
  className,
  hideError,
  field,
  classNameInput,
  classNameInfo,
  dontCheckUntilSubmit,
  classNameMin,
  classNameMax,
  minMaxFormatter,
  hideMinMax,
  ...rest
}: TSliderWithInfoProps) {
  const { hasError, formDomId } = useFieldError(field, dontCheckUntilSubmit);
  const classNameMinMax = "min-w-0 text-muted-foreground shrink leading-tight text-xs font-medium";

  const Min = useCallback(() => {
    if (rest.min === undefined || hideMinMax) return null;
    return (
      <p className={cn(classNameMinMax, classNameMin)}>
        {minMaxFormatter ? minMaxFormatter(rest.min) : rest.min.toLocaleString(appLocale)}
      </p>
    );
  }, [classNameMinMax, classNameMin, minMaxFormatter, rest.min, hideMinMax]);

  const Max = useCallback(() => {
    if (rest.max === undefined || hideMinMax) return null;
    return (
      <p className={cn(classNameMinMax, classNameMax)}>
        {minMaxFormatter ? minMaxFormatter(rest.max) : rest.max.toLocaleString(appLocale)}
      </p>
    );
  }, [classNameMinMax, classNameMax, minMaxFormatter, rest.max, hideMinMax]);

  return (
    <div
      data-form-id={formDomId}
      data-invalid={hasError || undefined}
      className={cn("flex flex-col", className)}
    >
      <div className="flex w-full gap-3">
        <Min />
        {/* Callers pass `value={x ? [x] : undefined}`; falling back to defaultValue
            keeps the slider controlled for its whole lifetime */}
        <Slider
          {...rest}
          value={rest.value ?? rest.defaultValue}
          className={cn("flex-1", classNameInput)}
        />
        <Max />
      </div>
      {!hideError && hasError ? (
        <ErrorLine
          className={cn("mt-1 bg-transparent py-1.5 pl-1.5", classNameInfo)}
          message={field.state.meta.errors[0].message}
        />
      ) : null}
    </div>
  );
}

export type TCommandItem = {
  value: string;
  label: string;
  description?: string;
  keywords?: string[];
};

// cmdk only searches the value, so id-backed items need the visible text as keywords
function commandItemKeywords(item: TCommandItem): string[] {
  if (item.keywords) return item.keywords;
  return item.description ? [item.label, item.description] : [item.label];
}

type TAsyncAndSearchableSelectProps = TFieldProps & {
  items: TCommandItem[] | undefined;
  isPending: boolean;
  error: string | undefined;
  CommandEmptyText: string;
  commandInputPlaceholder: string;
  CommandEmptyIcon: FC<{ className?: string }>;
  CommandItemElement?: FC<{ item: TCommandItem; className?: string }>;
  CommandItemsPinned?: FC<{ setIsOpen: (isOpen: boolean) => void; commandValue: string }>;
  TriggerWrapper?: FC<{
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    children: ReactElement;
  }>;
  className?: string;
  classNameInfo?: string;
  value: string;
  onChange: (value: string) => void;
  children: ({ isOpen }: { isOpen: boolean }) => ReactElement;
  commandInputValue?: string;
  commandInputValueOnChange?: (value: string) => void;
  commandShouldntFilter?: boolean;
};

const placeholderArray = Array.from({ length: 10 }, (_, index) => index);

function AsyncAndSearchableSelect({
  field,
  items,
  isPending,
  error,
  CommandEmptyText,
  commandInputPlaceholder,
  CommandEmptyIcon,
  CommandItemElement,
  CommandItemsPinned,
  TriggerWrapper,
  dontCheckUntilSubmit,
  hideError,
  classNameInfo,
  value,
  onChange,
  className,
  children,
  commandInputValue,
  commandInputValueOnChange,
  commandShouldntFilter,
}: TAsyncAndSearchableSelectProps) {
  const { hasError, formDomId } = useFieldError(field, dontCheckUntilSubmit);

  const [isOpen, setIsOpen] = useState(false);
  const [commandValue, setCommandValue] = useState(value);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const { shouldFilter, filter } = useMemo(() => {
    if (commandShouldntFilter || isPending) {
      return { shouldFilter: false, filter: () => 1 };
    }
    return { shouldFilter: undefined, filter: undefined };
  }, [isPending, commandShouldntFilter]);

  return (
    <div
      data-form-id={formDomId}
      data-invalid={hasError || undefined}
      className={cn("flex flex-col", className)}
    >
      {TriggerWrapper ? (
        <TriggerWrapper isOpen={isOpen} setIsOpen={setIsOpen}>
          {children({ isOpen })}
        </TriggerWrapper>
      ) : (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger render={children({ isOpen })} />
          <PopoverContent
            animate={false}
            className="flex h-68 max-h-[min(30rem,var(--available-height))] overflow-hidden p-0"
          >
            <Command
              value={commandValue}
              onValueChange={setCommandValue}
              shouldFilter={shouldFilter}
              filter={filter}
              wrapper="none"
              className="flex flex-1 flex-col"
            >
              <CommandInput
                showSpinner={isPending}
                placeholder={commandInputPlaceholder}
                value={commandInputValue}
                onValueChange={(v) => {
                  commandInputValueOnChange?.(v);
                  requestAnimationFrame(() => {
                    scrollAreaRef.current?.scrollTo({ top: 0 });
                  });
                }}
              />
              <ScrollArea viewportRef={scrollAreaRef} className="flex flex-1 flex-col">
                <CommandList>
                  {items && (
                    <CommandEmpty className="text-muted-foreground flex items-center justify-start gap-2 px-2.5 py-2.5 leading-tight">
                      <CommandEmptyIcon className="size-4.5 shrink-0" />
                      <p className="min-w-0 shrink">{CommandEmptyText}</p>
                    </CommandEmpty>
                  )}
                  <CommandGroup>
                    {!items &&
                      isPending &&
                      placeholderArray.map((_, index) => (
                        <CommandItem disabled key={index}>
                          <p className="bg-foreground animate-skeleton min-w-0 shrink rounded-md leading-tight">
                            Loading
                          </p>
                        </CommandItem>
                      ))}
                    {!items && !isPending && error && (
                      <ErrorCard className="rounded-md" message={error} />
                    )}
                    {items && CommandItemsPinned ? (
                      <CommandItemsPinned setIsOpen={setIsOpen} commandValue={value} />
                    ) : null}
                    {items &&
                      items.map((item) => (
                        <CommandItem
                          onSelect={(v) => {
                            onChange(v);
                            setIsOpen(false);
                          }}
                          value={item.value}
                          keywords={commandItemKeywords(item)}
                          key={item.value}
                          className="group/item px-3"
                          data-checked={field.state.value === item.value || undefined}
                        >
                          {CommandItemElement ? (
                            <CommandItemElement item={item} />
                          ) : (
                            <p className="min-w-0 shrink leading-tight">{item.label}</p>
                          )}
                          <CheckIcon
                            strokeWidth={2.5}
                            className="-mr-0.5 ml-auto size-4.5 opacity-0 group-data-checked/item:opacity-100"
                          />
                        </CommandItem>
                      ))}
                  </CommandGroup>
                </CommandList>
              </ScrollArea>
            </Command>
          </PopoverContent>
        </Popover>
      )}
      {!hideError && hasError ? (
        <ErrorLine
          className={cn("mt-1 bg-transparent py-1.5 pl-1.5", classNameInfo)}
          message={field.state.meta.errors[0].message}
        />
      ) : null}
    </div>
  );
}

type TAsyncInputWithItemsProps = TFieldProps & {
  items: TCommandItem[] | undefined;
  isPending: boolean;
  error: string | undefined;
  commandInputPlaceholder: string;
  CommandItemElement?: FC<{ item: TCommandItem; className?: string }>;
  CommandItemsPinned?: FC<{
    setIsOpen: (isOpen: boolean) => void;
    value: string;
    commandValue: string;
    inputValue: string;
  }>;
  className?: string;
  classNameInfo?: string;
  classNamePopoverContent?: string;
  classNameCommandEmpty?: string | (({ inputValue }: { inputValue: string }) => string);
  CommandEmptyText: string | FC<{ className?: string; inputValue: string }>;
  CommandEmptyIcon: FC<{ className?: string }>;
  commandFilter?: (value: string, search: string, keywords?: string[]) => number;
} & InputProps;

function AsyncInputWithItems({
  field,
  items,
  isPending,
  error,
  CommandEmptyText,
  commandInputPlaceholder,
  CommandEmptyIcon,
  CommandItemElement,
  CommandItemsPinned,
  dontCheckUntilSubmit,
  hideError,
  classNameInfo,
  value,
  className,
  classNamePopoverContent,
  classNameCommandEmpty,
  placeholder,
  commandFilter,
}: TAsyncInputWithItemsProps) {
  const { hasError, formDomId } = useFieldError(field, dontCheckUntilSubmit);

  const [isOpen, setIsOpen] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const [commandInputValue, setCommandInputValue] = useState(String(value));

  return (
    <div
      data-form-id={formDomId}
      data-invalid={hasError || undefined}
      className={cn("flex flex-col", className)}
    >
      <Popover
        open={isOpen}
        onOpenChange={(o) => {
          setIsOpen(o);
          if (o) {
            setCommandInputValue(String(value));
          } else {
            field.handleChange(commandInputValue);
          }
        }}
      >
        <Command
          filter={commandFilter ? commandFilter : undefined}
          wrapper="none"
          className="flex flex-1 flex-col overflow-visible"
        >
          <PopoverTrigger
            render={
              <Button
                variant="outline"
                forceMinSize={false}
                data-placeholder={value ? undefined : true}
                className="bg-input focus-visible:ring-primary/50 has-hover:hover:bg-input has-hover:hover:data-placeholder:text-muted-foreground/75 data-placeholder:text-muted-foreground/75 cursor-text justify-start px-3 text-left font-medium focus-visible:ring-1 focus-visible:ring-offset-0"
              >
                {value || placeholder}
              </Button>
            }
          />
          <PopoverContent
            animate={false}
            autoFocus={false}
            sideOffset={-42}
            className={cn(
              "group/content flex h-68 max-h-[min(30rem,var(--available-height))] overflow-visible border-none bg-transparent p-0 shadow-none",
              classNamePopoverContent,
            )}
          >
            <div className="flex w-full flex-col gap-1">
              <CommandInput
                showSpinner={isPending}
                placeholder={commandInputPlaceholder}
                value={commandInputValue}
                onValueChange={(v) => {
                  setCommandInputValue(v);
                  requestAnimationFrame(() => {
                    scrollAreaRef.current?.scrollTo({ top: 0 });
                  });
                }}
                className="bg-input focus-visible:ring-primary/50 placeholder:text-muted-foreground/75 rounded-lg border px-3 py-2.5 font-medium focus-visible:ring-1"
                classNameWrapper="border-none"
                hideIcon
              />
              <div className="bg-popover shadow-shadow-color/shadow-opacity flex w-full flex-1 flex-col overflow-hidden rounded-lg border shadow-lg group-data-[side=top]/content:order-first">
                <ScrollArea viewportRef={scrollAreaRef} className="flex flex-1 flex-col">
                  <CommandList>
                    {items && (
                      <CommandEmpty
                        className={cn(
                          "text-muted-foreground flex items-center justify-start gap-2 px-2.5 py-2.5 leading-tight",
                          typeof classNameCommandEmpty === "function"
                            ? classNameCommandEmpty?.({
                                inputValue: commandInputValue,
                              })
                            : classNameCommandEmpty,
                        )}
                      >
                        <CommandEmptyIcon className="size-4.5 shrink-0" />
                        {typeof CommandEmptyText === "string" ? (
                          <p className="min-w-0 shrink">{CommandEmptyText}</p>
                        ) : (
                          <CommandEmptyText inputValue={commandInputValue} />
                        )}
                      </CommandEmpty>
                    )}
                    <CommandGroup>
                      {!items &&
                        isPending &&
                        placeholderArray.map((_, index) => (
                          <CommandItem disabled key={index}>
                            <p className="bg-foreground animate-skeleton min-w-0 shrink rounded-md leading-tight">
                              Loading
                            </p>
                          </CommandItem>
                        ))}
                      {!items && !isPending && error && (
                        <ErrorCard className="rounded-md" message={error} />
                      )}
                      {items && CommandItemsPinned ? (
                        <CommandItemsPinned
                          value={String(value)}
                          setIsOpen={setIsOpen}
                          inputValue={commandInputValue}
                          commandValue=""
                        />
                      ) : null}
                      {items &&
                        items.map((item) => (
                          <CommandItem
                            onSelect={() => {
                              setIsOpen(false);
                              field.handleChange(item.value);
                            }}
                            value={item.value}
                            keywords={commandItemKeywords(item)}
                            key={item.value}
                            className="group/item px-3"
                            data-checked={value === item.value || undefined}
                          >
                            {CommandItemElement ? (
                              <CommandItemElement item={item} />
                            ) : (
                              <p className="min-w-0 shrink leading-tight">{item.label}</p>
                            )}
                            <CheckIcon
                              strokeWidth={2.5}
                              className="-mr-0.5 ml-auto size-4.5 opacity-0 group-data-checked/item:opacity-100"
                            />
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
      {!hideError && hasError ? (
        <ErrorLine
          className={cn("mt-1 bg-transparent py-1.5 pl-1.5", classNameInfo)}
          message={field.state.meta.errors[0].message}
        />
      ) : null}
    </div>
  );
}

type TAsyncDropdownMenuProps = TFieldProps & {
  items: TCommandItem[] | undefined;
  ItemIcon?: FC<{ className?: string; value: string }>;
  ItemSuffix?: FC<{ className?: string; value: string }>;
  isPending: boolean;
  error: string | undefined;
  className?: string;
  classNameInfo?: string;
  classNameDropdownContent?: string;
  classNameItem?: string | (({ value }: { value: string }) => string);
  value: string;
  onChange: (value: string) => void;
  dropdownTitle?: string;
  dropdownMenuContentAlign?: Parameters<typeof DropdownMenuContent>["0"]["align"];
  children: ({ isOpen }: { isOpen: boolean }) => ReactElement;
};

function AsyncDropdownMenu({
  field,
  items,
  ItemIcon,
  ItemSuffix,
  isPending,
  error,
  dontCheckUntilSubmit,
  hideError,
  value,
  onChange,
  className,
  classNameInfo,
  classNameDropdownContent,
  classNameItem,
  dropdownTitle,
  dropdownMenuContentAlign,
  children,
}: TAsyncDropdownMenuProps) {
  const { hasError, formDomId } = useFieldError(field, dontCheckUntilSubmit);

  const [isOpen, setIsOpen] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  return (
    <div
      data-form-id={formDomId}
      data-invalid={hasError || undefined}
      className={cn("flex flex-col", className)}
    >
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger render={children({ isOpen })} />
        <DropdownMenuContent
          animate={false}
          className={cn("w-(--anchor-width)", classNameDropdownContent)}
          align={dropdownMenuContentAlign}
        >
          <ScrollArea viewportRef={scrollAreaRef}>
            <DropdownMenuGroup>
              {dropdownTitle && (
                <>
                  <DropdownMenuLabel>{dropdownTitle}</DropdownMenuLabel>
                  <DropdownMenuSeparator className="-mx-1" />
                </>
              )}
              {!items && !isPending && error && (
                <ErrorCard className="rounded-md" message={error} />
              )}
              {!items &&
                isPending &&
                placeholderArray.slice(0, 4).map((_, index) => (
                  <DropdownMenuItem disabled key={index}>
                    <p className="bg-foreground animate-skeleton min-w-0 shrink rounded-md leading-tight">
                      Loading
                    </p>
                  </DropdownMenuItem>
                ))}
              {items &&
                items.map((item) => (
                  <DropdownMenuItem
                    key={item.value}
                    onClick={() => {
                      onChange(item.value);
                      setIsOpen(false);
                    }}
                    data-checked={value === item.value || undefined}
                    className={cn(
                      "group/item",
                      typeof classNameItem === "function"
                        ? classNameItem({ value: item.value })
                        : classNameItem,
                    )}
                  >
                    {ItemIcon && (
                      <ItemIcon className="-ml-0.5 size-5 shrink-0" value={item.value} />
                    )}
                    <div className="flex min-w-0 flex-wrap items-center gap-2.5 pr-1">
                      <p className="min-w-0 shrink leading-tight">{item.label}</p>
                      {ItemSuffix && <ItemSuffix value={item.value} />}
                    </div>
                    <CheckIcon
                      strokeWidth={2.5}
                      className="-mr-0.5 ml-auto size-4.5 opacity-0 group-data-checked/item:opacity-100"
                    />
                  </DropdownMenuItem>
                ))}
            </DropdownMenuGroup>
          </ScrollArea>
        </DropdownMenuContent>
      </DropdownMenu>
      {!hideError && hasError ? (
        <ErrorLine
          className={cn("mt-1 bg-transparent py-1.5 pl-1.5", classNameInfo)}
          message={field.state.meta.errors[0].message}
        />
      ) : null}
    </div>
  );
}

const { useAppForm: useAppFormBase, withForm } = createFormHook({
  fieldComponents: {
    TextField: InputWithInfo,
    AsyncInputWithItems,
    TokenField: TokenFieldWithInfo,
    DomainInput,
    StorageSizeInput,
    AsyncAndSearchableSelect,
    AsyncDropdownMenu,
  },
  formComponents: {
    SubmitButton: Button,
  },
  fieldContext,
  formContext,
});

export function useAppForm<
  TFormData,
  TOnMount extends undefined | FormValidateOrFn<TFormData>,
  TOnChange extends undefined | FormValidateOrFn<TFormData>,
  TOnChangeAsync extends undefined | FormAsyncValidateOrFn<TFormData>,
  TOnBlur extends undefined | FormValidateOrFn<TFormData>,
  TOnBlurAsync extends undefined | FormAsyncValidateOrFn<TFormData>,
  TOnSubmit extends undefined | FormValidateOrFn<TFormData>,
  TOnSubmitAsync extends undefined | FormAsyncValidateOrFn<TFormData>,
  TOnDynamic extends undefined | FormValidateOrFn<TFormData>,
  TOnDynamicAsync extends undefined | FormAsyncValidateOrFn<TFormData>,
  TOnServer extends undefined | FormAsyncValidateOrFn<TFormData>,
  TSubmitMeta,
>(
  options: FormOptions<
    TFormData,
    TOnMount,
    TOnChange,
    TOnChangeAsync,
    TOnBlur,
    TOnBlurAsync,
    TOnSubmit,
    TOnSubmitAsync,
    TOnDynamic,
    TOnDynamicAsync,
    TOnServer,
    TSubmitMeta
  >,
) {
  const formDomId = useId();
  const form = useAppFormBase({
    ...options,
    onSubmitInvalid: (props) => {
      scrollToFirstInvalidField(formDomId);
      options.onSubmitInvalid?.(props);
    },
  });
  formDomIds.set(form.store, formDomId);
  return form;
}

export { withForm };

export const DomainFieldSchema = z.string().url();
