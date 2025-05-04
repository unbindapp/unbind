import { TContextCommandPanelItemsContext } from "@/components/command-panel/context-command-panel/context-command-panel-items-provider";
import { getAllItemsFromCommandPanelPage } from "@/components/command-panel/helpers";
import { useCommandPanelStore } from "@/components/command-panel/store/command-panel-store-provider";
import { TCommandPanelItem, TCommandPanelPage } from "@/components/command-panel/types";
import ErrorCard from "@/components/error-card";
import KeyboardShortcut from "@/components/keyboard-shortcut";
import BottomDrawer, {
  BottomDrawerContent,
  BottomDrawerTrigger,
} from "@/components/navigation/bottom-drawer";
import { useDeviceSize } from "@/components/providers/device-size-provider";
import { useDeviceType } from "@/components/providers/device-type-provider";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  TCommandVariants,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  TDialogContentVariants,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/utils";
import { defaultDebounceMs } from "@/lib/constants";
import { DialogDescription } from "@radix-ui/react-dialog";
import { useCommandState } from "cmdk";
import { ChevronLeftIcon, ChevronRightIcon, LoaderIcon } from "lucide-react";
import { FC, ReactNode, RefObject, useCallback, useEffect, useMemo, useRef } from "react";
import { useHotkeys } from "react-hotkeys-hook";

type TProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  children?: ReactNode;
  title: string;
  description: string;
  dialogContentVariantOptions?: TDialogContentVariants;
};

const defaultCommandVariantOptionsDialog: TCommandVariants = {
  variant: "modal",
};

const defaultCommandVariantOptionsDrawer: TCommandVariants = {
  variant: "modal",
  wrapper: "none",
};

const defaultDialogContentVariantOptions: TDialogContentVariants = {
  variant: "styleless",
};

export function CommandPanelTrigger({
  rootPage,
  open,
  setOpen,
  children,
  currentPage,
  goToParentPage,
  useCommandPanelItems,
  setCurrentPageId,
  title,
  description,
  commandVariantOptions,
  dialogContentVariantOptions,
}: TProps & TCommandPanelProps) {
  const { isExtraSmall } = useDeviceSize();
  const mergedCommandPanelVariantOptionsDialog = useMemo(
    () => ({ ...defaultCommandVariantOptionsDialog, ...commandVariantOptions }),
    [commandVariantOptions],
  );
  const mergedCommandPanelVariantOptionsDrawer = useMemo(
    () => ({ ...defaultCommandVariantOptionsDrawer, ...commandVariantOptions }),
    [commandVariantOptions],
  );
  const mergedDialogContentVariantOptions = useMemo(
    () => ({ ...defaultDialogContentVariantOptions, ...dialogContentVariantOptions }),
    [dialogContentVariantOptions],
  );

  const onEscapeKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (rootPage.id !== currentPage.id) {
        e.preventDefault();
      }
    },
    [currentPage, rootPage],
  );

  if (isExtraSmall) {
    return (
      <BottomDrawer
        title="Command Panel"
        hideHeader
        open={open}
        onOpenChange={setOpen}
        classNameContent="h-[calc(100svh-3rem)]"
        noScrollArea
        dontAutoFocus
        onEscapeKeyDown={onEscapeKeyDown}
      >
        {children && <BottomDrawerTrigger>{children}</BottomDrawerTrigger>}
        <BottomDrawerContent>
          <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden pb-[var(--safe-area-inset-bottom)]">
            <CommandPanel
              rootPage={rootPage}
              setCurrentPageId={setCurrentPageId}
              currentPage={currentPage}
              goToParentPage={goToParentPage}
              useCommandPanelItems={useCommandPanelItems}
              commandVariantOptions={mergedCommandPanelVariantOptionsDrawer}
              className="rounded-2xl"
            />
          </div>
        </BottomDrawerContent>
      </BottomDrawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent
        onOpenAutoFocus={(e) => {
          if (typeof window === "undefined") return;
          const isTouchScreen = window.matchMedia("(pointer: coarse)").matches;
          if (!isTouchScreen) return;
          const element = e.target as HTMLElement | null;
          if (element === null) return;
          const focusable = element.querySelector("[tabindex]");
          if (!focusable) return;
          e.preventDefault();
          // @ts-expect-error this is a valid call
          focusable.focus?.();
        }}
        onEscapeKeyDown={onEscapeKeyDown}
        {...mergedDialogContentVariantOptions}
      >
        <DialogHeader>
          <DialogTitle className="sr-only">{title}</DialogTitle>
          <DialogDescription className="sr-only">{description}</DialogDescription>
        </DialogHeader>
        <CommandPanel
          rootPage={rootPage}
          setCurrentPageId={setCurrentPageId}
          currentPage={currentPage}
          goToParentPage={goToParentPage}
          useCommandPanelItems={useCommandPanelItems}
          commandVariantOptions={mergedCommandPanelVariantOptionsDialog}
          className="w-112"
        />
      </DialogContent>
    </Dialog>
  );
}

type TSetCurrentPageId = (id: string) => void;

type TCommandPanelProps = {
  currentPage: TCommandPanelPage;
  goToParentPage: (e?: KeyboardEvent) => void;
  useCommandPanelItems: () => TContextCommandPanelItemsContext;
  rootPage: TCommandPanelPage;
  setCurrentPageId: TSetCurrentPageId;
  className?: string;
  commandVariantOptions?: TCommandVariants;
};

function CommandPanel({
  currentPage,
  goToParentPage,
  useCommandPanelItems,
  rootPage,
  setCurrentPageId,
  commandVariantOptions,
  className,
}: TCommandPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const { isTouchscreen } = useDeviceType();
  const prevItemId = useCommandPanelStore((s) => s.prevItemId);
  const setPrevItemId = useCommandPanelStore((s) => s.setPrevItemId);
  const value = useCommandPanelStore((s) => s.value);
  const setValue = useCommandPanelStore((s) => s.setValue);

  const { items, isPending, isError } = useCommandPanelItems();

  useEffect(() => {
    const isTouchScreen =
      typeof window !== "undefined" ? window.matchMedia("(pointer: coarse)").matches : false;
    if (!isTouchScreen) {
      inputRef.current?.focus();
    }
  }, [currentPage]);

  useHotkeys(
    "arrowleft",
    (e) => {
      if (inputRef.current?.value) return;
      goToParentPage(e);
    },
    {
      enableOnContentEditable: true,
      enableOnFormTags: true,
    },
  );

  useHotkeys(
    "arrowright",
    () => {
      if (inputRef.current?.value) return;
      const item = currentPage.items?.find((i) => i.id === value || i.title === value);
      if (item?.subpage) {
        setCurrentPageId(item.subpage.id);
        setPrevItemId(item.id);
      }
    },
    {
      enableOnContentEditable: true,
      enableOnFormTags: true,
    },
  );

  useHotkeys(
    "esc",
    (e) => {
      goToParentPage(e);
    },
    {
      enableOnContentEditable: true,
      enableOnFormTags: true,
    },
  );

  useEffect(() => {
    if (isTouchscreen) return;
    if (isPending) return;

    requestAnimationFrame(() => {
      const prevItem = currentPage.items?.find((i) => i.id === prevItemId);
      const firstItem = scrollAreaRef.current?.querySelector("[cmdk-item]");
      const firstItemValue = firstItem?.getAttribute("data-value");

      const valueToSelect = prevItem?.title || firstItemValue;

      if (prevItem) setPrevItemId(null);
      if (valueToSelect) setValue(valueToSelect);
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, isPending, items]);

  return (
    <Command
      filter={
        isPending || isError || currentPage.usesSearchAsync || currentPage.disableCommandFilter
          ? () => 1
          : undefined
      }
      value={value}
      onValueChange={setValue}
      {...commandVariantOptions}
      className={className}
    >
      <Input
        useCommandPanelItems={useCommandPanelItems}
        placeholder={currentPage.inputPlaceholder}
        currentPage={currentPage}
        ref={inputRef}
        scrollAreaRef={scrollAreaRef}
      />
      <Content
        useCommandPanelItems={useCommandPanelItems}
        currentPage={currentPage}
        setCurrentPageId={setCurrentPageId}
        scrollAreaRef={scrollAreaRef}
      />
      <Footer rootPage={rootPage} currentPage={currentPage} goToParentPage={goToParentPage} />
    </Command>
  );
}

function Content({
  useCommandPanelItems,
  currentPage,
  setCurrentPageId,
  scrollAreaRef,
}: {
  useCommandPanelItems: () => TContextCommandPanelItemsContext;
  currentPage: TCommandPanelPage;
  setCurrentPageId: TSetCurrentPageId;
  scrollAreaRef: RefObject<HTMLDivElement | null>;
}) {
  const { items, isPending, isError, error, itemsPinned } = useCommandPanelItems();
  const allItems = useMemo(() => getAllItemsFromCommandPanelPage(currentPage), [currentPage]);

  const allOtherItems = useMemo(() => {
    if (!items) return [];
    return allItems.filter((i) => !items.map((c) => c.title).includes(i.title));
  }, [allItems, items]);

  return (
    <>
      {!isError && (
        <CommandEmpty className="text-muted-foreground w-full py-6 text-center text-base">
          {currentPage.commandEmptyText || "No matching results"}
        </CommandEmpty>
      )}
      <ScrollArea noFocusOnViewport viewportRef={scrollAreaRef}>
        <CommandList>
          <CommandGroup>
            {items && currentPage.ExplanationCard && (
              <ConditionalExplanationCard ExplanationCard={currentPage.ExplanationCard} />
            )}
            {items &&
              itemsPinned?.map((item, i) => (
                <Item
                  key={`${item.id || item.title}-${i}`}
                  item={item}
                  currentPageId={currentPage.id}
                  setCurrentPageId={setCurrentPageId}
                />
              ))}
            {!isPending &&
              items &&
              items.map((item, i) => (
                <Item
                  key={`${item.id || item.title}-${i}`}
                  item={item}
                  currentPageId={currentPage.id}
                  setCurrentPageId={setCurrentPageId}
                />
              ))}
            {!isPending &&
              !isError &&
              allOtherItems.map((item, i) => (
                <ConditionalItem
                  key={`${item.id || item.title}-${i}`}
                  item={item}
                  currentPageId={currentPage.id}
                  setCurrentPageId={setCurrentPageId}
                />
              ))}
            {isPending &&
              !items &&
              Array.from({ length: 10 }).map((_, i) => (
                <Item
                  key={`loading-${i}`}
                  item={{
                    id: `loading-${i}`,
                    title: `Loading ${i}`,
                    keywords: [],
                    Icon: LoaderIcon,
                  }}
                  currentPageId={currentPage.id}
                  setCurrentPageId={() => null}
                  isPlaceholder={true}
                  disabled={true}
                  fadeOnDisabled={false}
                />
              ))}
          </CommandGroup>
          {!items && !isPending && isError && (
            <div className="w-full p-1">
              <ErrorCard message={error?.message} />
            </div>
          )}
        </CommandList>
      </ScrollArea>
    </>
  );
}

function ConditionalExplanationCard({
  ExplanationCard,
}: {
  ExplanationCard: FC<{ className?: string }>;
}) {
  const search = useCommandPanelStore((state) => state.search);
  if (search) return null;
  return <ExplanationCard />;
}

function Footer({
  rootPage,
  currentPage,
  goToParentPage,
}: {
  rootPage: TCommandPanelPage;
  currentPage: TCommandPanelPage;
  goToParentPage: () => void;
}) {
  const goBackButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="text-muted-foreground z-10 flex w-full items-center justify-between gap-2 border-t p-1">
      <p className="min-w-0 shrink-2 overflow-hidden px-3 py-2 text-base font-medium text-ellipsis whitespace-nowrap sm:text-sm">
        {currentPage.title}
      </p>
      {currentPage.id !== rootPage.id && (
        <Button
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.stopPropagation();
            }
          }}
          onClick={goToParentPage}
          ref={goBackButtonRef}
          type="submit"
          size="sm"
          variant="ghost"
          className="min-w-0 shrink gap-1 rounded-lg px-3 py-2 text-base font-semibold sm:text-sm"
        >
          <ChevronLeftIcon className="-mr-0.5 -ml-1.75 size-5 shrink-0 sm:size-4.5" />
          <p className="min-w-0 shrink overflow-hidden text-ellipsis whitespace-nowrap">Back</p>
          <KeyboardShortcut className="-my-1 -mr-1 pl-1.25">esc</KeyboardShortcut>
        </Button>
      )}
    </div>
  );
}

function Input({
  useCommandPanelItems,
  currentPage,
  placeholder,
  ref,
  scrollAreaRef,
}: {
  useCommandPanelItems: () => TContextCommandPanelItemsContext;
  currentPage: TCommandPanelPage;
  placeholder: string;
  ref: RefObject<HTMLInputElement | null>;
  scrollAreaRef: RefObject<HTMLDivElement | null>;
}) {
  const setSearch = useCommandPanelStore((s) => s.setSearch);
  const inputValues = useCommandPanelStore((s) => s.inputValues);
  const setInputValue = useCommandPanelStore((s) => s.setInputValue);

  const { isPending } = useCommandPanelItems();

  const scrollId = useRef<NodeJS.Timeout | undefined>(undefined);
  const timeout = useRef<NodeJS.Timeout | null>(null);

  const inputValue = inputValues[currentPage.id] || "";

  useEffect(() => {
    if (timeout.current) clearTimeout(timeout.current);

    if (!inputValue || currentPage.setSearchDebounceMs === 0) {
      setSearch(inputValue);
    } else {
      timeout.current = setTimeout(
        () => {
          setSearch(inputValue);
        },
        currentPage.setSearchDebounceMs !== undefined
          ? currentPage.setSearchDebounceMs
          : defaultDebounceMs,
      );
    }

    return () => {
      if (timeout.current) clearTimeout(timeout.current);
    };
  }, [inputValue, setSearch, currentPage.usesSearchAsync, currentPage.setSearchDebounceMs]);

  return (
    <CommandInput
      ref={ref}
      showSpinner={isPending}
      value={inputValue}
      onValueChange={(value) => {
        setInputValue(currentPage.id, value);
        clearTimeout(scrollId.current);
        scrollId.current = setTimeout(() => {
          scrollAreaRef.current?.scrollTo({ top: 0 });
        });
      }}
      Icon={currentPage.InputIcon}
      className="py-3"
      placeholder={placeholder}
    />
  );
}

function ConditionalItem({
  item,
  currentPageId,
  setCurrentPageId,
}: {
  item: TCommandPanelItem;
  currentPageId: string;
  setCurrentPageId: (id: string) => void;
}) {
  const search = useCommandState((state) => state.search);
  if (!search) return null;
  return <Item item={item} currentPageId={currentPageId} setCurrentPageId={setCurrentPageId} />;
}

function Item({
  item,
  setCurrentPageId,
  isPlaceholder,
  disabled,
  fadeOnDisabled,
  currentPageId,
}: {
  item: TCommandPanelItem;
  setCurrentPageId: (id: string) => void;
  isPlaceholder?: boolean;
  disabled?: boolean;
  fadeOnDisabled?: boolean;
  currentPageId: string;
}) {
  const highlightedValue = useCommandState((s) => s.value);
  const isHighlighted = highlightedValue === item.title;

  useEffect(() => {
    if (isHighlighted) item.onHighlight?.();
  }, [isHighlighted, item]);

  const isPendingId = useCommandPanelStore((s) => s.isPendingId);
  const setPrevItemId = useCommandPanelStore((s) => s.setPrevItemId);
  const clearInputValue = useCommandPanelStore((s) => s.clearInputValue);

  const onSelect = useCallback(() => {
    if (item.subpage) {
      clearInputValue(currentPageId);
      setCurrentPageId(item.subpage.id);
    }
    if (item.subpage) {
      setPrevItemId(item.id);
    }
    item.onSelect?.({ isPendingId, setCurrentPageId });
  }, [item, setCurrentPageId, clearInputValue, currentPageId, setPrevItemId, isPendingId]);

  const isItemPending =
    isPendingId === null
      ? false
      : item.id !== undefined
        ? isPendingId === item.id
        : isPendingId === item.title;

  const Icon = useMemo(() => {
    if (isItemPending) {
      function Loader({ className }: { className?: string }) {
        return <LoaderIcon className={cn("animate-spin", className)} />;
      }
      return Loader;
    }
    return item.Icon;
  }, [isItemPending, item.Icon]);

  return (
    <CommandItem
      id={item.id}
      data-placeholder={isPlaceholder ? true : undefined}
      data-pending={isItemPending ? true : undefined}
      value={item.title}
      keywords={item.keywords}
      className="group/item active:bg-border flex w-full flex-row items-center justify-between gap-6 px-3.5 py-3 text-left font-medium data-placeholder:text-transparent"
      onSelect={onSelect}
      disabled={disabled || item.disabled}
      fadeOnDisabled={item.disabled === true ? "default" : fadeOnDisabled}
    >
      {isItemPending && (
        <div className="bg-background border-top-loader/25 absolute top-0 left-0 h-full w-full items-center justify-center overflow-hidden rounded-lg border">
          <div className="from-top-loader/0 via-top-loader/25 to-top-loader/0 animate-ping-pong absolute top-1/2 left-1/2 aspect-square w-[100%] origin-center -translate-1/2 bg-gradient-to-r" />
        </div>
      )}
      <div className="relative flex min-w-0 flex-1 items-center justify-start gap-2.5">
        <Icon className="group-data-placeholder/item:bg-foreground group-data-placeholder/item:animate-skeleton -ml-0.5 size-5 group-data-placeholder/item:rounded-full" />
        <p className="group-data-placeholder/item:bg-foreground group-data-placeholder/item:animate-skeleton min-w-0 shrink leading-tight group-data-placeholder/item:rounded-md">
          {item.title}
          {item.titleSuffix && <span className="text-muted-foreground">{item.titleSuffix}</span>}
        </p>
        {item.ChipComponent && <item.ChipComponent className="ml-auto shrink-0" />}
      </div>
      {item.subpage && <ChevronRightIcon className="relative -mr-1.5 size-5 shrink-0" />}
    </CommandItem>
  );
}
