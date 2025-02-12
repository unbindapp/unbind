"use client";

import {
  panelIdKey,
  panelPageKey,
  rootPanelPageIdForProject,
} from "@/components/command-panel/constants";
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
import {
  ArrowLeftIcon,
  BlocksIcon,
  ChevronRightIcon,
  DatabaseIcon,
} from "lucide-react";
import { useQueryState } from "nuqs";
import {
  FC,
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { toast } from "sonner";

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
  keywords: string[];
};

export default function ProjectCommandPanel({ className }: Props) {
  const [, setPanelId] = useQueryState(panelIdKey);
  const [, setPanelPageId] = useQueryState(panelPageKey);

  const onSelectPlaceholder = useCallback(() => {
    toast.success("Successful (Fake)", {
      description: "Imagine this working...",
      duration: 3000,
      closeButton: false,
    });
    setPanelId(null);
  }, [setPanelId]);

  const defaultPage: TPage = useMemo(
    () => ({
      id: rootPanelPageIdForProject,
      parentPageId: null,
      items: [
        {
          title: "GitHub Repo",
          keywords: ["deploy", "gitlab", "bitbucket"],
          onSelect: () => onSelectPlaceholder(),
          Icon: ({ className }) => (
            <ServiceIcon variant="github" className={className} />
          ),
        },
        {
          title: "Database",
          keywords: ["persistent", "persistence"],
          Icon: DatabaseIcon,
          subpage: {
            id: "databases",
            parentPageId: rootPanelPageIdForProject,
            items: [
              {
                title: "PostgreSQL",
                keywords: ["database", "sql", "mysql"],
                onSelect: () => onSelectPlaceholder(),
                Icon: ({ className }) => (
                  <ServiceIcon
                    color="brand"
                    variant="postgresql"
                    className={className}
                  />
                ),
              },
              {
                title: "Redis",
                keywords: ["database", "cache", "key value"],
                onSelect: () => onSelectPlaceholder(),
                Icon: ({ className }) => (
                  <ServiceIcon
                    color="brand"
                    variant="redis"
                    className={className}
                  />
                ),
              },
              {
                title: "MongoDB",
                keywords: ["database", "object"],
                onSelect: () => onSelectPlaceholder(),
                Icon: ({ className }) => (
                  <ServiceIcon
                    color="brand"
                    variant="mongodb"
                    className={className}
                  />
                ),
              },
              {
                title: "MySQL",
                keywords: ["database", "sql", "postgresql"],
                onSelect: () => onSelectPlaceholder(),
                Icon: ({ className }) => (
                  <ServiceIcon
                    color="brand"
                    variant="mysql"
                    className={className}
                  />
                ),
              },
              {
                title: "ClickHouse",
                keywords: ["database", "analytics", "sql"],
                onSelect: () => onSelectPlaceholder(),
                Icon: ({ className }) => (
                  <ServiceIcon
                    color="brand"
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
          keywords: ["deploy"],
          onSelect: () => onSelectPlaceholder(),
          Icon: ({ className }) => (
            <ServiceIcon variant="docker" className={className} />
          ),
        },
        {
          title: "Template",
          keywords: ["blueprint", "stack", "group"],
          Icon: BlocksIcon,
          subpage: {
            id: "templates",
            parentPageId: rootPanelPageIdForProject,
            items: [
              {
                title: "Strapi",
                keywords: ["cms", "content"],
                onSelect: () => onSelectPlaceholder(),
                Icon: ({ className }) => (
                  <ServiceIcon
                    color="brand"
                    variant="strapi"
                    className={className}
                  />
                ),
              },
              {
                title: "Umami",
                keywords: ["analytics", "privacy", "tracking"],
                onSelect: () => onSelectPlaceholder(),
                Icon: ({ className }) => (
                  <ServiceIcon
                    color="brand"
                    variant="umami"
                    className={className}
                  />
                ),
              },
              {
                title: "Meilisearch",
                keywords: ["full text search", "elasticsearch", "ram"],
                onSelect: () => onSelectPlaceholder(),
                Icon: ({ className }) => (
                  <ServiceIcon
                    color="brand"
                    variant="meilisearch"
                    className={className}
                  />
                ),
              },
              {
                title: "MinIO",
                keywords: ["s3", "file storage"],
                onSelect: () => onSelectPlaceholder(),
                Icon: ({ className }) => (
                  <ServiceIcon
                    color="brand"
                    variant="minio"
                    className={className}
                  />
                ),
              },
              {
                title: "PocketBase",
                keywords: [
                  "paas",
                  "backend",
                  "authentication",
                  "realtime database",
                  "file storage",
                ],
                onSelect: () => onSelectPlaceholder(),
                Icon: ({ className }) => (
                  <ServiceIcon
                    color="brand"
                    variant="pocketbase"
                    className={className}
                  />
                ),
              },
              {
                title: "N8N",
                keywords: ["workflow automation", "ai", "devops", "itops"],
                onSelect: () => onSelectPlaceholder(),
                Icon: ({ className }) => (
                  <ServiceIcon
                    color="brand"
                    variant="n8n"
                    className={className}
                  />
                ),
              },
              {
                title: "Ghost",
                keywords: ["blogging"],
                onSelect: () => onSelectPlaceholder(),
                Icon: ({ className }) => (
                  <ServiceIcon
                    color="brand"
                    variant="ghost"
                    className={className}
                  />
                ),
              },
            ],
          },
        },
      ],
    }),
    [onSelectPlaceholder]
  );

  const inputRef = useRef<HTMLInputElement>(null);

  const [currentPage, setCurrentPage] = useState(defaultPage);

  const allItems = useMemo(
    () => getAllItemsFromPage(currentPage),
    [currentPage]
  );

  const allOtherItems = useMemo(
    () =>
      allItems.filter(
        (i) => !currentPage.items.map((c) => c.title).includes(i.title)
      ),
    [allItems, currentPage]
  );

  const allPageIds = useMemo(() => {
    const ids = new Set<string>();
    const addIds = (page: TPage) => {
      ids.add(page.id);
      page.items.forEach((item) => {
        if (item.subpage) {
          addIds(item.subpage);
        }
      });
    };
    addIds(defaultPage);
    return [...ids];
  }, [defaultPage]);

  useEffect(() => {
    setPanelPageId(currentPage.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  const goToParent = useCallback(() => {
    if (currentPage.id === rootPanelPageIdForProject) {
      return;
    }
    if (currentPage.parentPageId === null) return;
    const parentPage = findParentPage(currentPage.parentPageId, defaultPage);
    if (parentPage) {
      setCurrentPage(parentPage);
    }
  }, [currentPage, defaultPage]);

  const goBackItem = useMemo(
    () => ({
      title: "Go Back",
      Icon: ArrowLeftIcon,
      keywords: ["return"],
      onSelect: () => goToParent(),
    }),
    [goToParent]
  );

  useHotkeys(
    "arrowleft",
    () => {
      if (inputRef.current?.value) return;
      goToParent();
    },
    {
      enableOnContentEditable: true,
      enableOnFormTags: true,
    }
  );

  useHotkeys(
    "esc",
    () => {
      goToParent();
    },
    {
      enableOnContentEditable: true,
      enableOnFormTags: true,
    }
  );

  return (
    <Command
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
        <CommandList>
          <CommandGroup>
            {currentPage.items.map((item) => (
              <Item
                key={item.title}
                item={item}
                setCurrentPage={setCurrentPage}
              />
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
      </ScrollArea>
    </Command>
  );
}

function ConditionalItem({
  item,
  setCurrentPage,
}: {
  item: TItem;
  setCurrentPage: (page: TPage) => void;
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
  currentPage: TPage;
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
  item: TItem;
  setCurrentPage: (page: TPage) => void;
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
      className="px-3.5 font-medium py-3 text-muted-foreground flex flex-row w-full items-center justify-between text-left gap-6"
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

function getAllItemsFromPage(page: TPage): TItem[] {
  return page.items.flatMap((item) => {
    if (item.subpage) {
      return [...getAllItemsFromPage(item.subpage)];
    }
    return item;
  });
}

function findParentPage(id: string, page: TPage): TPage | null {
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
