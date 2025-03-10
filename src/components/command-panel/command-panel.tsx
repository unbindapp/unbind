import {
  getAllItemsFromCommandPanelPage,
  getFirstCommandListItem,
} from "@/components/command-panel/helpers";
import { TCommandPanelItem, TCommandPanelPage } from "@/components/command-panel/types";
import ErrorCard from "@/components/error-card";
import KeyboardShortcut from "@/components/keyboard-shortcut";
import BottomDrawer, {
  BottomDrawerContent,
  BottomDrawerTrigger,
} from "@/components/navigation/bottom-drawer";
import { useDeviceSize } from "@/components/providers/device-size-provider";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DialogDescription } from "@radix-ui/react-dialog";
import { cva, VariantProps } from "class-variance-authority";
import { useCommandState } from "cmdk";
import { ChevronLeftIcon, ChevronRightIcon, LoaderIcon } from "lucide-react";
import { ReactNode, RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";

type TProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  children: ReactNode;
  title: string;
  description: string;
};

export function CommandPanelTrigger({
  rootPage,
  open,
  setOpen,
  children,
  currentPage,
  goToParentPage,
  useCommandPanelItems,
  allPageIds,
  setCurrentPageId,
  title,
  description,
}: TProps & CommandPanelProps) {
  const { isExtraSmall } = useDeviceSize();

  const onEscapeKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (currentPage.id === null) return;
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
        <BottomDrawerTrigger>{children}</BottomDrawerTrigger>
        <BottomDrawerContent>
          <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden pb-[var(--safe-area-inset-bottom)]">
            <CommandPanel
              rootPage={rootPage}
              allPageIds={allPageIds}
              setCurrentPageId={setCurrentPageId}
              currentPage={currentPage}
              goToParentPage={goToParentPage}
              useCommandPanelItems={useCommandPanelItems}
              variant="no-wrapper"
              className="rounded-2xl"
            />
          </div>
        </BottomDrawerContent>
      </BottomDrawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
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
        variant="styleless"
        className="w-112"
      >
        <DialogHeader>
          <DialogTitle className="sr-only">{title}</DialogTitle>
          <DialogDescription className="sr-only">{description}</DialogDescription>
        </DialogHeader>
        <CommandPanel
          rootPage={rootPage}
          allPageIds={allPageIds}
          setCurrentPageId={setCurrentPageId}
          currentPage={currentPage}
          goToParentPage={goToParentPage}
          useCommandPanelItems={useCommandPanelItems}
        />
      </DialogContent>
    </Dialog>
  );
}

type TUseCommandPanelItems = () => {
  items: TCommandPanelItem[] | undefined;
  isPending: boolean;
  isError: boolean;
  error: Error | null;
};

type TSetCurrentPageId = (id: string) => void;

const commandPanelVariants = cva("w-full", {
  variants: {
    variant: {
      default:
        "rounded-xl h-108 max-h-[min(calc(100vh-(100vh-3rem)*0.1-7rem),50vh)] sm:max-h-[calc(100vh-(100vh-3rem)*0.1-7rem)] border shadow-xl shadow-shadow/shadow",
      "no-wrapper": "",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

type CommandPanelProps = {
  currentPage: TCommandPanelPage;
  goToParentPage: (e?: KeyboardEvent) => void;
  useCommandPanelItems: TUseCommandPanelItems;
  rootPage: TCommandPanelPage;
  allPageIds: string[];
  setCurrentPageId: TSetCurrentPageId;
  className?: string;
} & TCommandPanelVariants;

type TCommandPanelVariants = VariantProps<typeof commandPanelVariants>;

function CommandPanel({
  currentPage,
  goToParentPage,
  useCommandPanelItems,
  rootPage,
  allPageIds,
  setCurrentPageId,
  variant,
  className,
}: CommandPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState("");
  const { isPending, isError } = useCommandPanelItems();

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
    "esc",
    () => {
      goToParentPage();
    },
    {
      enableOnContentEditable: true,
      enableOnFormTags: true,
    },
  );

  useEffect(() => {
    const value = getFirstCommandListItem(listRef);
    if (value) setValue(value);
  }, [currentPage]);

  return (
    <Command
      filter={isPending || isError ? () => 1 : undefined}
      value={value}
      onValueChange={setValue}
      variant="modal"
      className={commandPanelVariants({
        variant,
        className,
      })}
    >
      <Input
        useCommandPanelItems={useCommandPanelItems}
        placeholder={currentPage.inputPlaceholder}
        currentPage={currentPage}
        allPageIds={allPageIds}
        ref={inputRef}
      />
      <Content
        useCommandPanelItems={useCommandPanelItems}
        currentPage={currentPage}
        setCurrentPageId={setCurrentPageId}
        listRef={listRef}
      />
      <Footer rootPage={rootPage} currentPage={currentPage} goToParentPage={goToParentPage} />
    </Command>
  );
}

function Content({
  useCommandPanelItems,
  currentPage,
  setCurrentPageId,
}: {
  useCommandPanelItems: TUseCommandPanelItems;
  currentPage: TCommandPanelPage;
  setCurrentPageId: TSetCurrentPageId;
  listRef: RefObject<HTMLDivElement | null>;
}) {
  const { items, isPending, isError, error } = useCommandPanelItems();
  const allItems = useMemo(() => getAllItemsFromCommandPanelPage(currentPage), [currentPage]);

  const allOtherItems = useMemo(() => {
    if (!items) return [];
    return allItems.filter((i) => !items.map((c) => c.title).includes(i.title));
  }, [allItems, items]);

  return (
    <>
      {!isError && (
        <CommandEmpty className="text-muted-foreground w-full py-6 text-center text-base">
          No matching results
        </CommandEmpty>
      )}
      <ScrollArea noFocusOnViewport>
        <CommandList>
          <CommandGroup>
            {!isPending &&
              items &&
              items.map((item) => (
                <Item key={item.title} item={item} setCurrentPageId={setCurrentPageId} />
              ))}
            {!isPending &&
              !isError &&
              allOtherItems.map((item) => (
                <ConditionalItem key={item.title} item={item} setCurrentPageId={setCurrentPageId} />
              ))}
            {isPending &&
              !items &&
              Array.from({ length: 10 }).map((_, i) => (
                <Item
                  key={i}
                  item={{
                    title: `Loading ${i}`,
                    keywords: [],
                    Icon: LoaderIcon,
                  }}
                  setCurrentPageId={() => null}
                  isPlaceholder={true}
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
  allPageIds,
  placeholder,
  ref,
}: {
  useCommandPanelItems: TUseCommandPanelItems;
  currentPage: TCommandPanelPage;
  allPageIds: string[];
  placeholder: string;
  ref: RefObject<HTMLInputElement | null>;
}) {
  const [values, setValues] = useState(Object.fromEntries(allPageIds.map((id) => [id, ""])));

  const { isPending } = useCommandPanelItems();

  return (
    <CommandInput
      ref={ref}
      showSpinner={isPending}
      value={values[currentPage.id]}
      onValueChange={(value) => {
        setValues((prev) => ({ ...prev, [currentPage.id]: value }));
      }}
      placeholder={placeholder}
    />
  );
}

function ConditionalItem({
  item,
  setCurrentPageId,
}: {
  item: TCommandPanelItem;
  setCurrentPageId: (id: string) => void;
}) {
  const search = useCommandState((state) => state.search);
  if (!search) return null;
  return <Item item={item} setCurrentPageId={setCurrentPageId} />;
}

function Item({
  item,
  setCurrentPageId,
  isPlaceholder,
}: {
  item: TCommandPanelItem;
  setCurrentPageId: (id: string) => void;
  isPlaceholder?: boolean;
}) {
  const search = useCommandState((state) => state.search);
  const value = useCommandState((state) => state.value);

  const onSelect = useCallback(() => {
    if (item.subpage) {
      setCurrentPageId(item.subpage.id);
    }
    item.onSelect?.();
  }, [item, setCurrentPageId]);

  useHotkeys("arrowright", () => onSelect(), {
    enabled:
      value === item.title &&
      item.subpage !== undefined &&
      (search === undefined || search === null || search === ""),
    enableOnContentEditable: true,
    enableOnFormTags: true,
  });

  return (
    <CommandItem
      data-placeholder={isPlaceholder ? true : undefined}
      value={item.title}
      keywords={item.keywords}
      className="group/item active:bg-border flex w-full flex-row items-center justify-between gap-6 px-3.5 py-3 text-left font-medium data-placeholder:text-transparent"
      onSelect={onSelect}
    >
      <div className="flex min-w-0 flex-1 items-center justify-start gap-2.5">
        <item.Icon className="group-data-placeholder/item:bg-foreground group-data-placeholder/item:animate-skeleton -ml-0.5 size-5 group-data-placeholder/item:rounded-full" />
        <p className="group-data-placeholder/item:bg-foreground group-data-placeholder/item:animate-skeleton min-w-0 shrink leading-tight group-data-placeholder/item:rounded-md">
          {item.title}
        </p>
      </div>
      {item.subpage && <ChevronRightIcon className="-mr-1.5 size-5 shrink-0" />}
    </CommandItem>
  );
}
