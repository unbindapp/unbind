"use client";

import ServiceIcon from "@/components/icons/service";
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
import { ChevronRightIcon, DatabaseIcon } from "lucide-react";
import { FC, useCallback, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";

type Props = {
  className?: string;
};

type TPage = {
  id: string;
  items: TItem[];
  parentPageId: string | null;
};

type TItem = {
  title: string;
  Icon: FC<{ className?: string }>;
  subpage?: TPage;
  onSelect?: () => void;
};

const defaultPage: TPage = {
  id: "new_service",
  parentPageId: null,
  items: [
    {
      title: "GitHub Repo",
      Icon: ({ className }) => (
        <ServiceIcon variant="github" className={className} />
      ),
    },
    {
      title: "Database",
      Icon: DatabaseIcon,
      subpage: {
        id: "databases",
        parentPageId: "new_service",
        items: [
          {
            title: "PostgreSQL",
            Icon: ({ className }) => (
              <ServiceIcon
                color="color"
                variant="postgresql"
                className={className}
              />
            ),
          },
          {
            title: "Redis",
            Icon: ({ className }) => (
              <ServiceIcon
                color="color"
                variant="redis"
                className={className}
              />
            ),
          },
          {
            title: "MySQL",
            Icon: ({ className }) => (
              <ServiceIcon
                color="color"
                variant="mysql"
                className={className}
              />
            ),
          },
          {
            title: "ClickHouse",
            Icon: ({ className }) => (
              <ServiceIcon
                color="color"
                variant="clickhouse"
                className={className}
              />
            ),
          },
        ],
      },
    },
    {
      title: "Docker Image",
      Icon: ({ className }) => (
        <ServiceIcon variant="docker" className={className} />
      ),
    },
  ],
};

export default function ProjectCommandPanel({ className }: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollId = useRef<NodeJS.Timeout>(null);

  const [currentPage, setCurrentPage] = useState(defaultPage);

  useHotkeys(
    "arrowleft",
    () => {
      if (currentPage.id === defaultPage.id) return;
      if (currentPage.parentPageId === null) return;
      const parentPage = findParentPage(currentPage.parentPageId, defaultPage);
      if (parentPage) setCurrentPage(parentPage);
    },
    {
      enabled:
        inputRef.current === undefined ||
        inputRef.current?.value === undefined ||
        inputRef.current.value === "",
      enableOnContentEditable: true,
      enableOnFormTags: true,
    }
  );

  return (
    <Command
      variant="modal"
      className={cn(
        "w-full rounded-xl min-h-96 border shadow-xl shadow-shadow/[var(--opacity-shadow)]",
        className
      )}
    >
      <CommandInput
        ref={inputRef}
        onValueChange={() => {
          if (scrollId.current) clearTimeout(scrollId.current);
          scrollId.current = setTimeout(() => {
            const div = listRef.current;
            div?.scrollTo({ top: 0 });
          });
        }}
        placeholder="Deploy something..."
      />
      <CommandEmpty className="text-muted-foreground w-full text-center text-base py-6">
        Nothing found.
      </CommandEmpty>
      <ScrollArea viewportRef={listRef}>
        <CommandList>
          <CommandGroup>
            {currentPage.items.map((item) => (
              <Item
                key={item.title}
                item={item}
                setCurrentPage={setCurrentPage}
              />
            ))}
          </CommandGroup>
        </CommandList>
      </ScrollArea>
    </Command>
  );
}

function Item({
  item,
  setCurrentPage,
}: {
  item: TItem;
  setCurrentPage: (page: TPage) => void;
}) {
  const search = useCommandState((state) => state.search);
  const value = useCommandState((state) => state.value);

  const onSelect = useCallback(() => {
    if (item.subpage) {
      setCurrentPage(item.subpage);
      return;
    }
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
      className="px-3.5 font-medium py-3 text-muted-foreground flex flex-row w-full items-center justify-between text-left gap-6"
      onSelect={onSelect}
    >
      <div className="flex-1 gap-2.5 flex items-center justify-start">
        <item.Icon className="size-5 -ml-0.5" />
        {item.title}
      </div>
      {item.subpage && <ChevronRightIcon className="size-5 -mr-1.5" />}
    </CommandItem>
  );
}

function findParentPage(id: string, page: TPage): TPage | null {
  // recursively find the parent page
  if (page.id === id) return page;
  if (page.items) {
    for (const item of page.items) {
      if (item.subpage) {
        const found = findParentPage(id, item.subpage);
        if (found) return found;
      }
    }
  }
  return null;
}
