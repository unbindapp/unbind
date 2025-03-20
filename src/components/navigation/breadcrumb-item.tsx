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
import { ArrowRightIcon, CheckIcon, ChevronDownIcon, PlusIcon } from "lucide-react";
import { ComponentProps, Dispatch, FC, SetStateAction, useEffect, useState } from "react";

type Item<T> = T & { id: string; display_name: string };

type TProps<T> = {
  title: string;
  selectedItem: Item<T> | undefined;
  items: Item<T>[] | undefined;
  onSelect: (id: string) => void;
  IconItem?: FC<{ id: string; className?: string }>;
  flipChevronOnSm?: boolean;
  showArrow?: (i: T) => boolean;
} & (
  | { newItemTitle: string; onSelectNewItem: () => void }
  | { newItemTitle?: undefined; onSelectNewItem?: undefined }
);

export function BreadcrumbItem<T>({
  title,
  selectedItem,
  items,
  onSelect,
  IconItem,
  flipChevronOnSm,
  newItemTitle,
  onSelectNewItem,
  showArrow,
}: TProps<T>) {
  const [open, setOpen] = useState(false);
  const [lastHoveredItem, setLastHoveredItem] = useState(selectedItem);

  useEffect(() => {
    setLastHoveredItem(selectedItem);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const newItem = newItemTitle ? ({ id: "new", display_name: newItemTitle } as Item<T>) : undefined;

  return (
    <DropdownOrDrawer title={title} open={open} onOpenChange={setOpen}>
      <DropdownOrDrawerTrigger>
        <Trigger item={selectedItem} Icon={IconItem} flipChevronOnSm={flipChevronOnSm} />
      </DropdownOrDrawerTrigger>
      <DropdownOrDrawerContentForDrawer>
        <div className="group/list flex w-full flex-col px-2 pt-2 pb-8">
          {items?.map((i, index) => {
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
              <div className="bg-border pointer-events-none my-2 h-px w-full shrink-0 rounded-full" />
              <SheetItem
                item={newItem}
                onSelect={onSelectNewItem}
                setOpen={setOpen}
                selectedItem={selectedItem}
                lastHoveredItem={lastHoveredItem}
                setLastHoveredItem={setLastHoveredItem}
                IconItem={PlusIcon}
                className="text-muted-foreground data-highlighted:text-foreground data-last-hovered:text-foreground mr-4"
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
  showArrow?: (i: Item<T>) => boolean;
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
      data-show-arrow={showArrow?.(item) ? true : undefined}
      variant="ghost"
      className={cn(
        `data-last-hovered:bg-border data-highlighted:group-has-[*[data-highlighted]]/list:bg-border group/item data-highlighted:text-foreground flex w-full cursor-default items-center justify-between gap-3 rounded-lg px-3 py-3.5 text-left font-medium group-has-[*[data-highlighted]]/list:bg-transparent`,
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        {IconItem && <IconItem id={item.id} className="-my-1 -ml-1 size-5 shrink-0" />}
        <p className="min-w-0 shrink">{item.display_name}</p>
      </div>
      <div className="relative -mr-0.5 size-5">
        {selectedItem?.id === item.id && (
          <>
            <CheckIcon
              className="size-full transition group-data-highlighted/item:group-data-show-arrow/item:rotate-90 group-data-highlighted/item:group-data-show-arrow/item:opacity-0"
              strokeWidth={2.5}
            />
            <ArrowRightIcon
              className="absolute top-0 left-0 size-full -rotate-90 opacity-0 transition group-data-highlighted/item:group-data-show-arrow/item:rotate-0 group-data-highlighted/item:group-data-show-arrow/item:opacity-100"
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
  showArrow?: (i: Item<T>) => boolean;
  IconItem?: FC<{ id: string; className?: string }>;
  className?: string;
}) {
  return (
    <DropdownMenuItem
      onSelect={() => {
        setOpen(false);
        onSelect(item.id);
      }}
      data-show-arrow={showArrow?.(item) ? true : undefined}
      data-last-hovered={lastHoveredItem?.id === item.id ? true : undefined}
      className={cn(
        `group/item data-last-hovered:bg-border data-highlighted:group-has-[*[data-highlighted]]/list:bg-border justify-between group-has-[*[data-highlighted]]/list:bg-transparent`,
        className,
      )}
      onMouseEnter={() => setLastHoveredItem(item)}
      onTouchStart={() => setLastHoveredItem(item)}
    >
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        {IconItem && <IconItem id={item.id} className="-my-1 -ml-0.5 size-4.5 shrink-0" />}
        <p className="min-w-0 shrink">{item.display_name}</p>
      </div>
      <div className="relative -mr-0.5 size-4.5 shrink-0 transition-transform group-data-highlighted/item:group-data-show-arrow/item:rotate-90">
        {selectedItem?.id === item.id && (
          <>
            <CheckIcon
              className="size-full transition-opacity group-data-highlighted/item:group-data-show-arrow/item:opacity-0"
              strokeWidth={3}
            />
            <ArrowRightIcon
              className="absolute top-0 left-0 size-full -rotate-90 opacity-0 transition-opacity group-data-highlighted/item:group-data-show-arrow/item:opacity-100"
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
        `group/button relative flex max-w-32 items-center justify-start gap-2 rounded border-none px-1.5 py-3.5 text-sm font-medium focus-visible:ring-0 focus-visible:ring-offset-0 active:bg-transparent has-hover:hover:bg-transparent data-no-icon:pl-2.75`,
        className,
      )}
      {...rest}
    >
      <div className="pointer-events-none absolute top-0 left-0 h-full w-full py-1.5">
        <div className="bg-border/0 has-hover:group-hover/button:bg-border group-active/button:bg-border group-focus-visible/button:ring-primary/50 h-full w-full rounded-lg group-focus-visible/button:ring-1" />
      </div>
      {Icon && item && <Icon id={item.id} className="relative size-4.5" />}
      <p className="group-data-pending/button:bg-foreground group-data-pending/button:animate-skeleton relative truncate py-0.5 leading-none group-data-pending/button:rounded-sm group-data-pending/button:text-transparent">
        {item == undefined ? "Loading" : item?.display_name}
      </p>
      <ChevronDownIcon
        data-flip-chevron-sm={flipChevronOnSm ? true : undefined}
        className="text-muted-more-foreground relative -my-1 -ml-1 size-4 transition group-data-[state=open]/button:rotate-180 data-flip-chevron-sm:rotate-180 group-data-[state=open]/button:data-flip-chevron-sm:rotate-360 sm:data-flip-chevron-sm:rotate-0 sm:group-data-[state=open]/button:data-flip-chevron-sm:rotate-180"
      />
    </Button>
  );
}
