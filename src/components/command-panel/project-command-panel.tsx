"use client";

import { rootPanelPageIdForProject } from "@/components/command-panel/constants";
import {
  getAllItemsFromCommandPanelPage,
  getFirstCommandListItem,
} from "@/components/command-panel/helpers";
import ProjectCommandPanelItemsProvider, {
  useProjectCommandPanelItems,
} from "@/components/command-panel/project-command-panel-data-provider";
import {
  TCommandPanelItem,
  TCommandPanelPage,
} from "@/components/command-panel/types";
import useProjectCommandPanelConfig from "@/components/command-panel/use-project-command-panel-config";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/utils";
import { useCommandState } from "cmdk";
import { ChevronLeftIcon, ChevronRightIcon, LoaderIcon } from "lucide-react";
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
  teamId: string;
  projectId: string;
  className?: string;
};

export default function ProjectCommandPanel({
  teamId,
  projectId,
  className,
}: Props) {
  const {
    currentPage,
    setCurrentPage,
    setPanelPageId,
    allPageIds,
    goToParentPage,
  } = useProjectCommandPanelConfig({ teamId });

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPanelPageId(currentPage.id);
    const isTouchScreen =
      typeof window !== "undefined"
        ? window.matchMedia("(pointer: coarse)").matches
        : false;
    if (!isTouchScreen) {
      inputRef.current?.focus();
    }
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
    <ProjectCommandPanelItemsProvider
      teamId={teamId}
      projectId={projectId}
      page={currentPage}
    >
      <Panel
        className={className}
        allPageIds={allPageIds}
        currentPage={currentPage}
        goToParentPage={goToParentPage}
        inputRef={inputRef}
        setCurrentPage={setCurrentPage}
      />
    </ProjectCommandPanelItemsProvider>
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

  const { isPending, isError } = useProjectCommandPanelItems();

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
        "w-full rounded-xl h-108 max-h-[calc(100vh-(100vh-3rem)*0.1-7rem)] border shadow-xl shadow-shadow/[var(--opacity-shadow)]",
        className
      )}
    >
      <Input
        placeholder={currentPage.inputPlaceholder}
        currentPage={currentPage}
        allPageIds={allPageIds}
        ref={inputRef}
      />
      <Content
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        listRef={listRef}
      />
      <Footer currentPage={currentPage} goToParentPage={goToParentPage} />
    </Command>
  );
}

function Content({
  currentPage,
  setCurrentPage,
  listRef,
}: {
  currentPage: TCommandPanelPage;
  setCurrentPage: (page: TCommandPanelPage) => void;
  listRef: RefObject<HTMLDivElement | null>;
}) {
  const { items, isPending, isError, error } = useProjectCommandPanelItems();
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
  currentPage,
  goToParentPage,
}: {
  currentPage: TCommandPanelPage;
  goToParentPage: () => void;
}) {
  const goBackButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="w-full z-10 p-1 flex items-center justify-between border-t text-muted-foreground gap-2">
      <p className="shrink-[2] text-sm font-medium px-3 py-2 min-w-0 overflow-hidden overflow-ellipsis whitespace-nowrap">
        {currentPage.title}
      </p>
      {currentPage.id !== rootPanelPageIdForProject && (
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
  currentPage,
  allPageIds,
  placeholder,
  ref,
}: {
  currentPage: TCommandPanelPage;
  allPageIds: string[];
  placeholder: string;
  ref: RefObject<HTMLInputElement | null>;
}) {
  const [values, setValues] = useState(
    Object.fromEntries(allPageIds.map((id) => [id, ""]))
  );

  const { isPending } = useProjectCommandPanelItems();

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
  setCurrentPage,
}: {
  item: TCommandPanelItem;
  setCurrentPage: (page: TCommandPanelPage) => void;
}) {
  const search = useCommandState((state) => state.search);
  if (!search) return null;
  return <Item item={item} setCurrentPage={setCurrentPage} />;
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
