import {
  getAllItemsFromCommandPanelPage,
  getFirstCommandListItem,
} from "@/components/command-panel/helpers";
import {
  TCommandPanelItem,
  TCommandPanelPage,
} from "@/components/command-panel/types";
import ErrorCard from "@/components/error-card";
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
import { useCommandState } from "cmdk";
import { ChevronLeftIcon, ChevronRightIcon, LoaderIcon } from "lucide-react";
import {
  ReactNode,
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useHotkeys } from "react-hotkeys-hook";

type Props = {
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
}: Props & CommandPanelProps) {
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
        onEscapeKeyDown={(e) => {
          if (currentPage.id === null) return;
          if (rootPage.id !== currentPage.id) {
            e.preventDefault();
          }
        }}
        variant="styleless"
        className="w-112"
      >
        <DialogHeader>
          <DialogTitle className="sr-only">{title}</DialogTitle>
          <DialogDescription className="sr-only">
            {description}
          </DialogDescription>
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

type CommandPanelProps = {
  currentPage: TCommandPanelPage;
  goToParentPage: (e?: KeyboardEvent) => void;
  useCommandPanelItems: TUseCommandPanelItems;
  rootPage: TCommandPanelPage;
  allPageIds: string[];
  setCurrentPageId: TSetCurrentPageId;
};

function CommandPanel({
  currentPage,
  goToParentPage,
  useCommandPanelItems,
  rootPage,
  allPageIds,
  setCurrentPageId,
}: CommandPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState("");
  const { isPending, isError } = useCommandPanelItems();

  useEffect(() => {
    const isTouchScreen =
      typeof window !== "undefined"
        ? window.matchMedia("(pointer: coarse)").matches
        : false;
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
    }
  );

  useHotkeys(
    "esc",
    () => {
      goToParentPage();
    },
    {
      enableOnContentEditable: true,
      enableOnFormTags: true,
    }
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
      className="w-full rounded-xl h-108 max-h-[min(calc(100vh-(100vh-3rem)*0.1-7rem),50vh)] sm:max-h-[calc(100vh-(100vh-3rem)*0.1-7rem)] border shadow-xl shadow-shadow/[var(--opacity-shadow)]"
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
      <Footer
        rootPage={rootPage}
        currentPage={currentPage}
        goToParentPage={goToParentPage}
      />
    </Command>
  );
}

function Content({
  useCommandPanelItems,
  currentPage,
  setCurrentPageId,
  listRef,
}: {
  useCommandPanelItems: TUseCommandPanelItems;
  currentPage: TCommandPanelPage;
  setCurrentPageId: TSetCurrentPageId;
  listRef: RefObject<HTMLDivElement | null>;
}) {
  const { items, isPending, isError, error } = useCommandPanelItems();
  const allItems = useMemo(
    () => getAllItemsFromCommandPanelPage(currentPage),
    [currentPage]
  );

  const allOtherItems = useMemo(() => {
    if (!items) return [];
    return allItems.filter((i) => !items.map((c) => c.title).includes(i.title));
  }, [allItems, items]);

  return (
    <>
      {!isError && (
        <CommandEmpty className="text-muted-foreground w-full text-center text-base py-6">
          No matching results
        </CommandEmpty>
      )}
      <ScrollArea noFocusOnViewport>
        <CommandList ref={listRef}>
          <CommandGroup>
            {!isPending &&
              items &&
              items.map((item) => (
                <Item
                  key={item.title}
                  item={item}
                  setCurrentPageId={setCurrentPageId}
                />
              ))}
            {!isPending &&
              !isError &&
              allOtherItems.map((item) => (
                <ConditionalItem
                  key={item.title}
                  item={item}
                  setCurrentPageId={setCurrentPageId}
                />
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
    <div className="w-full z-10 p-1 flex items-center justify-between border-t text-muted-foreground gap-2">
      <p className="shrink-[2] text-sm font-medium px-3 py-2 min-w-0 overflow-hidden overflow-ellipsis whitespace-nowrap">
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
          className="rounded-lg shrink min-w-0 px-3 py-2 font-semibold gap-1"
        >
          <ChevronLeftIcon className="size-4.5 shrink-0 -ml-1.75" />
          <p className="shrink min-w-0 overflow-hidden overflow-ellipsis whitespace-nowrap">
            Back
          </p>
          <div className="-my-1 shrink-0 -mr-1 pl-1.25">
            <div
              className="text-xxs ring-1 ring-border rounded px-1.5 py-1.25 
              leading-none bg-background-hover"
            >
              esc
            </div>
          </div>
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
  const [values, setValues] = useState(
    Object.fromEntries(allPageIds.map((id) => [id, ""]))
  );

  const { isPending } = useCommandPanelItems();

  return (
    <CommandInput
      showSpinner={isPending}
      value={values[currentPage.id]}
      onValueChange={(value) => {
        setValues((prev) => ({ ...prev, [currentPage.id]: value }));
      }}
      ref={ref}
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
      className="px-3.5 font-medium group/item data-[placeholder]:text-transparent py-3 flex flex-row w-full items-center justify-between text-left gap-6"
      onSelect={onSelect}
    >
      <div className="flex-1 min-w-0 gap-2.5 flex items-center justify-start">
        <item.Icon className="size-5 -ml-0.5 group-data-[placeholder]/item:rounded-full group-data-[placeholder]/item:bg-foreground group-data-[placeholder]/item:animate-skeleton" />
        <p className="shrink min-w-0 leading-tight group-data-[placeholder]/item:rounded-md group-data-[placeholder]/item:bg-foreground group-data-[placeholder]/item:animate-skeleton">
          {item.title}
        </p>
      </div>
      {item.subpage && <ChevronRightIcon className="size-5 -mr-1.5 shrink-0" />}
    </CommandItem>
  );
}
