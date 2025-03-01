import {
  DropdownOrDrawer,
  DropdownOrDrawerContentForDrawer,
  DropdownOrDrawerContentForDropdown,
  DropdownOrDrawerTrigger,
} from "@/components/navigation/dropdown-or-drawer";
import { Button } from "@/components/ui/button";
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/components/ui/utils";
import {
  ArrowRightIcon,
  CheckIcon,
  ChevronDownIcon,
  PlusIcon,
} from "lucide-react";
import { usePathname } from "next/navigation";
import {
  ComponentProps,
  Dispatch,
  FC,
  SetStateAction,
  useEffect,
  useState,
} from "react";

type Item<T> = T & { id: string; title: string };

type Props<T> = {
  title: string;
  selectedItem: Item<T> | undefined;
  items: Item<T>[] | undefined;
  onSelect: (id: string) => void;
  getHrefForId: (id: string) => string | null;
  IconItem?: FC<{ id: string; className?: string }>;
  flipChevronOnSm?: boolean;
} & (
  | { newItemTitle: string; onSelectNewItem: () => void }
  | { newItemTitle?: undefined; onSelectNewItem?: undefined }
);

export function BreadcrumbItem<T>({
  title,
  selectedItem,
  items,
  onSelect,
  getHrefForId,
  IconItem,
  flipChevronOnSm,
  newItemTitle,
  onSelectNewItem,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [lastHoveredItem, setLastHoveredItem] = useState(selectedItem);

  useEffect(() => {
    setLastHoveredItem(selectedItem);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const newItem = newItemTitle
    ? ({ id: "new", title: newItemTitle } as Item<T>)
    : undefined;

  return (
    <DropdownOrDrawer title={title} open={open} onOpenChange={setOpen}>
      <DropdownOrDrawerTrigger>
        <Trigger
          item={selectedItem}
          Icon={IconItem}
          flipChevronOnSm={flipChevronOnSm}
        />
      </DropdownOrDrawerTrigger>
      <DropdownOrDrawerContentForDrawer>
        <div className="w-full flex flex-col px-2 pt-2 pb-8 group/list">
          {items?.map((i, index) => {
            const href = getHrefForId(i.id);
            const showArrow = href !== null && pathname !== href;
            return (
              <SheetItem
                item={i}
                key={i.id + index}
                onSelect={onSelect}
                setOpen={setOpen}
                selectedItem={selectedItem}
                lastHoveredItem={lastHoveredItem}
                setLastHoveredItem={setLastHoveredItem}
                IconItem={IconItem}
                showArrow={showArrow}
              />
            );
          })}
          {newItemTitle && newItem && (
            <>
              <div className="w-full bg-border h-px rounded-full my-2 shrink-0 pointer-events-none" />
              <SheetItem
                item={newItem}
                onSelect={onSelectNewItem}
                setOpen={setOpen}
                selectedItem={selectedItem}
                lastHoveredItem={lastHoveredItem}
                setLastHoveredItem={setLastHoveredItem}
                IconItem={PlusIcon}
                className="text-muted-foreground data-highlighted:text-foreground data-last-hovered:text-foreground"
              />
            </>
          )}
        </div>
      </DropdownOrDrawerContentForDrawer>
      <DropdownOrDrawerContentForDropdown>
        <DropdownMenuLabel>{title}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {items?.map((i, index) => {
            const href = getHrefForId(i.id);
            const showArrow = href !== null && pathname !== href;
            return (
              <DropdownItem
                item={i}
                key={i.id + index}
                onSelect={onSelect}
                setOpen={setOpen}
                selectedItem={selectedItem}
                lastHoveredItem={lastHoveredItem}
                setLastHoveredItem={setLastHoveredItem}
                IconItem={IconItem}
                showArrow={showArrow}
              />
            );
          })}
        </DropdownMenuGroup>
        {newItemTitle && newItem && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownItem
                item={newItem}
                onSelect={onSelectNewItem}
                setOpen={setOpen}
                selectedItem={selectedItem}
                lastHoveredItem={lastHoveredItem}
                setLastHoveredItem={setLastHoveredItem}
                IconItem={PlusIcon}
                className="text-muted-foreground data-highlighted:text-foreground data-last-hovered:text-foreground"
              />
            </DropdownMenuGroup>
          </>
        )}
      </DropdownOrDrawerContentForDropdown>
    </DropdownOrDrawer>
  );
}

function SheetItem<T>({
  item,
  selectedItem,
  setOpen,
  onSelect,
  lastHoveredItem,
  setLastHoveredItem,
  showArrow,
  IconItem,
  className,
}: {
  item: Item<T>;
  selectedItem: Item<T> | undefined;
  setOpen: (open: boolean) => void;
  onSelect: (id: string) => void;
  lastHoveredItem: Item<T> | undefined;
  setLastHoveredItem: Dispatch<SetStateAction<Item<T> | undefined>>;
  showArrow?: boolean;
  IconItem?: FC<{ id: string; className?: string }>;
  className?: string;
}) {
  return (
    <Button
      onClick={() => {
        setOpen(false);
        onSelect(item.id);
      }}
      data-last-hovered={lastHoveredItem?.id === item.id ? true : undefined}
      onMouseEnter={() => setLastHoveredItem(item)}
      onTouchStart={() => setLastHoveredItem(item)}
      data-show-arrow={showArrow ? true : undefined}
      variant="ghost"
      className={cn(
        "w-full data-last-hovered:bg-border group-has-[*[data-highlighted]]/list:bg-transparent data-highlighted:group-has-[*[data-highlighted]]/list:bg-border text-left px-3 py-3.5 rounded-lg font-medium flex items-center justify-between gap-3 group/item cursor-default data-highlighted:text-foreground",
        className
      )}
    >
      <div className="flex-1 min-w-0 flex items-center gap-1.5">
        {IconItem && (
          <IconItem id={item.id} className="-my-1 size-5 -ml-1 shrink-0" />
        )}
        <p className="shrink min-w-0">{item.title}</p>
      </div>
      <div className="size-5 -mr-0.5 relative">
        {selectedItem?.id === item.id && (
          <>
            <CheckIcon
              className="size-full group-data-highlighted/item:group-data-show-arrow/item:opacity-0 
              group-data-highlighted/item:group-data-show-arrow/item:rotate-90 transition"
              strokeWidth={2.5}
            />
            <ArrowRightIcon
              className="absolute left-0 top-0 opacity-0 -rotate-90 size-full 
              group-data-highlighted/item:group-data-show-arrow/item:opacity-100
              group-data-highlighted/item:group-data-show-arrow/item:rotate-0 transition"
              strokeWidth={2.5}
            />
          </>
        )}
      </div>
    </Button>
  );
}

function DropdownItem<T>({
  item,
  selectedItem,
  setOpen,
  onSelect,
  lastHoveredItem,
  setLastHoveredItem,
  showArrow,
  IconItem,
  className,
}: {
  item: Item<T>;
  selectedItem: Item<T> | undefined;
  setOpen: (open: boolean) => void;
  onSelect: (id: string) => void;
  lastHoveredItem: Item<T> | undefined;
  setLastHoveredItem: Dispatch<SetStateAction<Item<T> | undefined>>;
  showArrow?: boolean;
  IconItem?: FC<{ id: string; className?: string }>;
  className?: string;
}) {
  return (
    <DropdownMenuItem
      onSelect={() => {
        setOpen(false);
        onSelect(item.id);
      }}
      data-show-arrow={showArrow ? true : undefined}
      data-last-hovered={lastHoveredItem?.id === item.id ? true : undefined}
      className={cn(
        "justify-between group/item data-last-hovered:bg-border group-has-[*[data-highlighted]]/list:bg-transparent data-highlighted:group-has-[*[data-highlighted]]/list:bg-border",
        className
      )}
      onMouseEnter={() => setLastHoveredItem(item)}
      onTouchStart={() => setLastHoveredItem(item)}
    >
      <div className="flex-1 min-w-0 flex items-center gap-1.5">
        {IconItem && (
          <IconItem id={item.id} className="-my-1 size-4.5 -ml-0.5 shrink-0" />
        )}
        <p className="shrink min-w-0">{item.title}</p>
      </div>
      <div className="size-4.5 shrink-0 -mr-0.5 relative group-data-highlighted/item:group-data-show-arrow/item:rotate-90 transition-transform">
        {selectedItem?.id === item.id && (
          <>
            <CheckIcon
              className="size-full group-data-highlighted/item:group-data-show-arrow/item:opacity-0 transition-opacity"
              strokeWidth={3}
            />
            <ArrowRightIcon
              className="absolute left-0 top-0 opacity-0 -rotate-90 size-full group-data-highlighted/item:group-data-show-arrow/item:opacity-100 transition-opacity"
              strokeWidth={2.5}
            />
          </>
        )}
      </div>
    </DropdownMenuItem>
  );
}

function Trigger<T>({
  item,
  Icon,
  className,
  flipChevronOnSm,
  ...rest
}: ComponentProps<"button"> & {
  item?: Item<T>;
  Icon?: FC<{ id: string; className: string }>;
  flipChevronOnSm?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      forceMinSize={false}
      data-no-icon={Icon === undefined ? true : undefined}
      data-pending={item == undefined ? true : undefined}
      className={cn(
        `px-1.5 py-4 data-no-icon:pl-2.75 rounded border-none font-medium flex items-center justify-start gap-2 
        has-hover:hover:bg-transparent active:bg-transparent text-sm group/button relative
        focus-visible:ring-0 focus-visible:ring-offset-0`,
        className
      )}
      {...rest}
    >
      <div className="absolute left-0 top-0 w-full h-full pointer-events-none py-1.5">
        <div
          className="w-full h-full rounded-lg bg-border/0 has-hover:group-hover/button:bg-border group-active/button:bg-border
          group-focus-visible/button:ring-1 group-focus-visible/button:ring-primary/50"
        />
      </div>
      {Icon && item && <Icon id={item.id} className="relative size-4.5" />}
      <p
        className="group-data-pending/button:text-transparent group-data-pending/button:bg-foreground 
          group-data-pending/button:rounded-sm group-data-pending/button:animate-skeleton max-w-32 whitespace-nowrap 
          leading-none overflow-hidden text-ellipsis relative"
      >
        {item == undefined ? "Loading" : item?.title}
      </p>
      <ChevronDownIcon
        data-flip-chevron-sm={flipChevronOnSm ? true : undefined}
        className="size-4 -my-1 relative -ml-1 text-muted-more-foreground group-data-[state=open]/button:rotate-180 
        data-flip-chevron-sm:rotate-180 group-data-[state=open]/button:data-flip-chevron-sm:rotate-360 
        sm:data-flip-chevron-sm:rotate-0 sm:group-data-[state=open]/button:data-flip-chevron-sm:rotate-180 transition"
      />
    </Button>
  );
}
