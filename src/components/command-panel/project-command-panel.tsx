"use client";

import { rootPanelPageIdForProject } from "@/components/command-panel/constants";
import {
  getAllItemsFromCommandPanelPage,
  getFirstCommandListItem,
} from "@/components/command-panel/helpers";
import ProjectCommandPanelDataProvider, {
  useProjectCommandPanelData,
} from "@/components/command-panel/project-command-panel-data-provider";
import {
  TCommandPanelItem,
  TCommandPanelPage,
} from "@/components/command-panel/types";
import useProjectCommandPanelConfig from "@/components/command-panel/use-project-command-panel-config";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/utils";
import { useCommandState } from "cmdk";
import {
  ArrowLeftIcon,
  ChevronRightIcon,
  LoaderIcon,
  TriangleAlertIcon,
} from "lucide-react";
import {
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useHotkeys } from "react-hotkeys-hook";

type Props = {
  className?: string;
};

export default function ProjectCommandPanel({ className }: Props) {
  const {
    currentPage,
    setCurrentPage,
    setPanelPageId,
    allPageIds,
    goToParentPage,
  } = useProjectCommandPanelConfig();

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPanelPageId(currentPage.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  return (
    <ProjectCommandPanelDataProvider page={currentPage}>
      <Panel
        className={className}
        allPageIds={allPageIds}
        currentPage={currentPage}
        goToParentPage={goToParentPage}
        inputRef={inputRef}
        setCurrentPage={setCurrentPage}
      />
    </ProjectCommandPanelDataProvider>
  );
}

function Panel({
  currentPage,
  allPageIds,
  setCurrentPage,
  goToParentPage,
  inputRef,
  className,
}: {
  allPageIds: string[];
  currentPage: TCommandPanelPage;
  setCurrentPage: (page: TCommandPanelPage) => void;
  goToParentPage: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
  className?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState("");

  const { isPending, isError } = useProjectCommandPanelData();

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
      className={cn(
        "w-full rounded-xl h-96 border shadow-xl shadow-shadow/[var(--opacity-shadow)]",
        className
      )}
    >
      <Input currentPage={currentPage} allPageIds={allPageIds} ref={inputRef} />
      <Content
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        goToParentPage={goToParentPage}
        listRef={listRef}
      />
    </Command>
  );
}

function Content({
  currentPage,
  setCurrentPage,
  goToParentPage,
  listRef,
}: {
  currentPage: TCommandPanelPage;
  setCurrentPage: (page: TCommandPanelPage) => void;
  goToParentPage: () => void;
  listRef: RefObject<HTMLDivElement | null>;
}) {
  const { data: items, isPending, isError } = useProjectCommandPanelData();
  const allItems = useMemo(
    () => getAllItemsFromCommandPanelPage(currentPage),
    [currentPage]
  );

  const allOtherItems = useMemo(() => {
    if (!items) return [];
    return allItems.filter((i) => !items.map((c) => c.title).includes(i.title));
  }, [allItems, items]);

  const goBackItem = useMemo(
    () => ({
      title: "Go Back",
      Icon: ArrowLeftIcon,
      keywords: ["return"],
      onSelect: () => goToParentPage(),
    }),
    [goToParentPage]
  );

  return (
    <>
      {!isError && (
        <CommandEmpty className="text-muted-foreground w-full text-center text-base py-6">
          No matching results
        </CommandEmpty>
      )}
      <ScrollArea>
        <CommandList ref={listRef}>
          <CommandGroup>
            {!isPending &&
              items &&
              items.map((item) => (
                <Item
                  key={item.title}
                  item={item}
                  setCurrentPage={setCurrentPage}
                />
              ))}
            {!isPending &&
              !isError &&
              allOtherItems.map((item) => (
                <ConditionalItem
                  key={item.title}
                  item={item}
                  setCurrentPage={setCurrentPage}
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
                  setCurrentPage={() => null}
                  isPlaceholder={true}
                />
              ))}
            {currentPage.id !== rootPanelPageIdForProject && (
              <Item item={goBackItem} setCurrentPage={setCurrentPage} />
            )}
          </CommandGroup>
          {!isPending && !items && isError && (
            <div className="w-full flex flex-col items-center px-4 py-6 gap-1 text-center text-destructive">
              <TriangleAlertIcon className="size-5" />
              <p className="w-full">Something went wrong</p>
            </div>
          )}
        </CommandList>
      </ScrollArea>
    </>
  );
}

function ConditionalItem({
  item,
  setCurrentPage,
}: {
  item: TCommandPanelItem;
  setCurrentPage: (page: TCommandPanelPage) => void;
}) {
  const search = useCommandState((state) => state.search);
  if (!search) return null;
  return <Item item={item} setCurrentPage={setCurrentPage} />;
}

function Input({
  currentPage,
  allPageIds,
  ref,
}: {
  currentPage: TCommandPanelPage;
  allPageIds: string[];
  ref: RefObject<HTMLInputElement | null>;
}) {
  const [values, setValues] = useState(
    Object.fromEntries(allPageIds.map((id) => [id, ""]))
  );

  const { isPending } = useProjectCommandPanelData();

  return (
    <CommandInput
      showSpinner={isPending}
      value={values[currentPage.id]}
      onValueChange={(value) => {
        setValues((prev) => ({ ...prev, [currentPage.id]: value }));
      }}
      ref={ref}
      placeholder="Deploy something..."
    />
  );
}

function Item({
  item,
  setCurrentPage,
  isPlaceholder,
}: {
  item: TCommandPanelItem;
  setCurrentPage: (page: TCommandPanelPage) => void;
  isPlaceholder?: boolean;
}) {
  const search = useCommandState((state) => state.search);
  const value = useCommandState((state) => state.value);

  const onSelect = useCallback(() => {
    if (item.subpage) {
      setCurrentPage(item.subpage);
    }
    item.onSelect?.();
  }, [item, setCurrentPage]);

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
