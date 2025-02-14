"use client";

import { rootPanelPageIdForProject } from "@/components/command-panel/constants";
import {
  getAllItemsFromCommandPanelPage,
  getFirstCommandListItem,
} from "@/components/command-panel/helpers";
import {
  TCommandPanelItem,
  TCommandPanelPage,
} from "@/components/command-panel/types";
import useProjectCommandPanelData from "@/components/command-panel/use-project-command-panel-data";
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
import { ArrowLeftIcon, ChevronRightIcon } from "lucide-react";
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
  } = useProjectCommandPanelData();

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState("");

  useEffect(() => {
    setPanelPageId(currentPage.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  useEffect(() => {
    const value = getFirstCommandListItem(listRef);
    if (value) setValue(value);
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
    <Command
      value={value}
      onValueChange={setValue}
      variant="modal"
      className={cn(
        "w-full rounded-xl h-96 border shadow-xl shadow-shadow/[var(--opacity-shadow)]",
        className
      )}
    >
      <Input currentPage={currentPage} allPageIds={allPageIds} ref={inputRef} />
      <CommandEmpty className="text-muted-foreground w-full text-center text-base py-6">
        No matching results
      </CommandEmpty>
      <ScrollArea>
        <List
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          goToParentPage={goToParentPage}
          listRef={listRef}
        />
      </ScrollArea>
    </Command>
  );
}

function List({
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
  const allItems = useMemo(
    () => getAllItemsFromCommandPanelPage(currentPage),
    [currentPage]
  );

  const allOtherItems = useMemo(
    () =>
      allItems.filter(
        (i) => !currentPage.items.map((c) => c.title).includes(i.title)
      ),
    [allItems, currentPage]
  );

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
    <CommandList ref={listRef}>
      <CommandGroup>
        {currentPage.items.map((item) => (
          <Item key={item.title} item={item} setCurrentPage={setCurrentPage} />
        ))}
        {allOtherItems.map((item) => (
          <ConditionalItem
            key={item.title}
            item={item}
            setCurrentPage={setCurrentPage}
          />
        ))}
        {currentPage.id !== rootPanelPageIdForProject && (
          <Item item={goBackItem} setCurrentPage={setCurrentPage} />
        )}
      </CommandGroup>
    </CommandList>
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

  return (
    <CommandInput
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
}: {
  item: TCommandPanelItem;
  setCurrentPage: (page: TCommandPanelPage) => void;
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
      value={item.title}
      keywords={item.keywords}
      className="px-3.5 font-medium py-3 flex flex-row w-full items-center justify-between text-left gap-6"
      onSelect={onSelect}
    >
      <div className="flex-1 min-w-0 gap-2.5 flex items-center justify-start">
        <item.Icon className="size-5 -ml-0.5" />
        <p className="shrink min-w-0 leading-tight">{item.title}</p>
      </div>
      {item.subpage && <ChevronRightIcon className="size-5 -mr-1.5 shrink-0" />}
    </CommandItem>
  );
}
