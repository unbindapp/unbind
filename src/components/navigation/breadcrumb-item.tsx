import { ComingSoonChip } from "@/components/coming-soon";
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
import { ArrowRightIcon, CheckIcon, ChevronDownIcon, LoaderIcon, PlusIcon } from "lucide-react";
import {
  ButtonHTMLAttributes,
  ComponentProps,
  Dispatch,
  FC,
  ReactNode,
  SetStateAction,
  useCallback,
  useEffect,
  useState,
} from "react";

type Item<T> = T & { id: string; name: string };

type TProps<T> = {
  title: string;
  selectedItem: Item<T> | undefined | null;
  items: Item<T>[] | undefined;
  onSelect: (id: string) => void;
  onHover: (id: string) => void;
  IconItem?: FC<{ id: string; className?: string }>;
  flipChevronOnSm?: boolean;
  showArrow?: (i: T) => boolean;
} & (
  | {
      newItemTitle: string;
      newItemIsPending: boolean;
      newItemDontCloseMenuOnSelect?: boolean;
      newItemComingSoon?: boolean;
      NewItemWrapper?: FC<{ children: ReactNode }>;
      onSelectNewItem: (id: string) => void;
    }
  | {
      newItemTitle?: never;
      newItemIsPending?: never;
      onSelectNewItem?: never;
      NewItemWrapper?: never;
      newItemComingSoon?: never;
      newItemDontCloseMenuOnSelect?: never;
    }
) &
  ({ open: boolean; setOpen: (open: boolean) => void } | { open?: never; setOpen?: never });

export function BreadcrumbItem<T>({
  title,
  selectedItem,
  items,
  onSelect,
  onHover,
  IconItem,
  flipChevronOnSm,
  newItemTitle,
  newItemIsPending,
  newItemDontCloseMenuOnSelect,
  newItemComingSoon,
  NewItemWrapper,
  onSelectNewItem,
  showArrow,
  open: openProp,
  setOpen: setOpenProp,
}: TProps<T>) {
  const [openLocal, setOpenLocal] = useState(false);
  const [lastHoveredItem, setLastHoveredItem] = useState(selectedItem);

  const open = openProp !== undefined ? openProp : openLocal;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenLocal;

  useEffect(() => {
    setLastHoveredItem(selectedItem);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const newItem = newItemTitle ? ({ id: "new", name: newItemTitle } as Item<T>) : undefined;

  const ConditionalNewItemWrapper = useCallback(
    ({ children }: { children: ReactNode }) => {
      if (NewItemWrapper) {
        return <NewItemWrapper>{children}</NewItemWrapper>;
      }
      return children;
    },
    [NewItemWrapper],
  );

  return (
    <DropdownOrDrawer title={title} open={open} onOpenChange={setOpen}>
      <DropdownOrDrawerTrigger>
        <Trigger
          item={selectedItem === null ? { name: "Not Found", id: "not-found" } : selectedItem}
          Icon={IconItem}
          flipChevronOnSm={flipChevronOnSm}
        />
      </DropdownOrDrawerTrigger>
      <DropdownOrDrawerContentForDrawer>
        <div className="group/list flex w-full flex-col px-2 pt-2 pb-[calc(var(--safe-area-inset-bottom)+2rem)]">
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
              <ConditionalNewItemWrapper>
                <SheetItem
                  dontCloseMenuOnSelect={newItemDontCloseMenuOnSelect}
                  item={newItem}
                  isPending={newItemIsPending}
                  onSelect={onSelectNewItem}
                  setOpen={setOpen}
                  selectedItem={selectedItem}
                  lastHoveredItem={lastHoveredItem}
                  setLastHoveredItem={setLastHoveredItem}
                  IconItem={PlusIcon}
                  comingSoon={newItemComingSoon}
                  className="text-muted-foreground data-highlighted:text-foreground data-last-hovered:text-foreground mr-4"
                />
              </ConditionalNewItemWrapper>
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
                onHover={onHover}
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
              <ConditionalNewItemWrapper>
                <DropdownItem
                  dontCloseMenuOnSelect={newItemDontCloseMenuOnSelect}
                  item={newItem}
                  isPending={newItemIsPending}
                  comingSoon={newItemComingSoon}
                  onSelect={onSelectNewItem}
                  setOpen={setOpen}
                  selectedItem={selectedItem}
                  lastHoveredItem={lastHoveredItem}
                  setLastHoveredItem={setLastHoveredItem}
                  IconItem={PlusIcon}
                  className="text-muted-foreground"
                />
              </ConditionalNewItemWrapper>
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
  dontCloseMenuOnSelect,
  onSelect,
  lastHoveredItem,
  setLastHoveredItem,
  showArrow,
  IconItem,
  isPending,
  className,
  disabled,
  comingSoon,
  ...rest
}: {
  item: Item<T>;
  selectedItem: Item<T> | null | undefined;
  setOpen: (open: boolean) => void;
  dontCloseMenuOnSelect?: boolean;
  onSelect: (id: string) => void;
  lastHoveredItem: Item<T> | null | undefined;
  setLastHoveredItem: Dispatch<SetStateAction<Item<T> | null | undefined>>;
  showArrow?: (i: Item<T>) => boolean;
  IconItem?: FC<{ id: string; className?: string }>;
  isPending?: boolean;
  comingSoon?: boolean;
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onSelect">) {
  return (
    <Button
      onClick={() => {
        if (comingSoon) return;
        if (!dontCloseMenuOnSelect) {
          setOpen(false);
        }
        onSelect(item.id);
      }}
      data-pending={isPending ? true : undefined}
      data-last-hovered={lastHoveredItem?.id === item.id ? true : undefined}
      onMouseEnter={() => setLastHoveredItem(item)}
      onTouchStart={() => setLastHoveredItem(item)}
      data-show-arrow={showArrow?.(item) ? true : undefined}
      variant="ghost"
      className={cn(
        `data-last-hovered:bg-border data-highlighted:group-has-[*[data-highlighted]]/list:bg-border group/item data-highlighted:text-foreground flex w-full cursor-default items-center justify-between gap-3 rounded-lg px-3 py-3.5 text-left font-medium group-has-[*[data-highlighted]]/list:bg-transparent`,
        className,
      )}
      disabled={comingSoon || disabled}
      fadeOnDisabled={comingSoon ? false : undefined}
      {...rest}
    >
      {isPending && (
        <div className="bg-background border-top-loader/25 absolute top-0 left-0 h-full w-full items-center justify-center overflow-hidden rounded-lg border">
          <div className="from-top-loader/0 via-top-loader/25 to-top-loader/0 animate-ping-pong absolute top-1/2 left-1/2 aspect-square w-full origin-center -translate-1/2 bg-gradient-to-r" />
        </div>
      )}
      <div className="group-data-pending/item:text-foreground relative flex min-w-0 flex-1 items-center gap-1.5">
        {IconItem ? (
          isPending ? (
            <LoaderIcon id={item.id} className="-my-1 -ml-1 size-5 shrink-0 animate-spin" />
          ) : (
            <IconItem id={item.id} className="-my-1 -ml-1 size-5 shrink-0" />
          )
        ) : null}
        <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
          <p className="min-w-0 shrink">{item.name}</p>
          {comingSoon && <ComingSoonChip classNameParagraph="px-2.5 py-0.5 text-sm" />}
        </div>
      </div>
      {!comingSoon && (
        <div className="group-data-pending/item:text-foreground relative -mr-0.5 size-5">
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
      )}
    </Button>
  );
}

function DropdownItem<T>({
  item,
  selectedItem,
  setOpen,
  dontCloseMenuOnSelect,
  onSelect,
  onHover,
  lastHoveredItem,
  setLastHoveredItem,
  showArrow,
  IconItem,
  isPending,
  className,
  comingSoon,
  disabled,
  ...rest
}: {
  item: Item<T>;
  selectedItem: Item<T> | null | undefined;
  setOpen: (open: boolean) => void;
  dontCloseMenuOnSelect?: boolean;
  onSelect: (id: string) => void;
  onHover?: (id: string) => void;
  lastHoveredItem: Item<T> | null | undefined;
  setLastHoveredItem: Dispatch<SetStateAction<Item<T> | null | undefined>>;
  showArrow?: (i: Item<T>) => boolean;
  IconItem?: FC<{ id: string; className?: string }>;
  isPending?: boolean;
  comingSoon?: boolean;
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onSelect">) {
  return (
    <DropdownMenuItem
      onSelect={(e) => {
        if (!dontCloseMenuOnSelect) {
          setOpen(false);
        } else {
          e.preventDefault();
        }
        onSelect(item.id);
      }}
      data-show-arrow={showArrow?.(item) ? true : undefined}
      data-last-hovered={lastHoveredItem?.id === item.id ? true : undefined}
      className={cn(`group/item`, className)}
      data-pending={isPending ? true : undefined}
      // @ts-expect-error - TODO - Check this later, fine for now
      onMouseEnter={() => {
        if (comingSoon) return;
        onHover?.(item.id);
        setLastHoveredItem(item);
      }}
      // @ts-expect-error - TODO - Check this later, fine for now
      onTouchStart={() => {
        if (comingSoon) return;
        onHover?.(item.id);
        setLastHoveredItem(item);
      }}
      disabled={comingSoon || disabled}
      fadeOnDisabled={comingSoon ? false : undefined}
      {...rest}
    >
      {isPending && (
        <div className="bg-background border-top-loader/25 absolute top-0 left-0 h-full w-full items-center justify-center overflow-hidden rounded-md border">
          <div className="from-top-loader/0 via-top-loader/25 to-top-loader/0 animate-ping-pong absolute top-1/2 left-1/2 aspect-square w-full origin-center -translate-1/2 bg-gradient-to-r" />
        </div>
      )}
      <div className="group-data-pending/item:text-foreground relative flex min-w-0 flex-1 items-center gap-1.5">
        {IconItem ? (
          isPending ? (
            <LoaderIcon id={item.id} className="-my-1 -ml-0.5 size-4.5 shrink-0 animate-spin" />
          ) : (
            <IconItem id={item.id} className="-my-1 -ml-0.5 size-4.5 shrink-0" />
          )
        ) : null}
        <div className="flex min-w-0 shrink items-center justify-between gap-3">
          <p className="min-w-0 shrink">{item.name}</p>
          {comingSoon && <ComingSoonChip className="-mr-1" />}
        </div>
      </div>
      {!comingSoon && (
        <div className="group-data-pending/item:text-foreground relative -mr-0.5 size-4.5 shrink-0 transition-transform group-data-highlighted/item:group-data-show-arrow/item:rotate-90">
          {selectedItem?.id === item.id && (
            <>
              <CheckIcon
                className="size-full transition-opacity group-data-highlighted/item:group-data-show-arrow/item:opacity-0"
                strokeWidth={2.5}
              />
              <ArrowRightIcon
                className="absolute top-0 left-0 size-full -rotate-90 opacity-0 transition-opacity group-data-highlighted/item:group-data-show-arrow/item:opacity-100"
                strokeWidth={2.5}
              />
            </>
          )}
        </div>
      )}
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
        {item == undefined ? "Loading" : item?.name}
      </p>
      <ChevronDownIcon
        data-flip-chevron-sm={flipChevronOnSm ? true : undefined}
        className="text-muted-more-foreground relative -my-1 -ml-1 size-4 transition group-data-[state=open]/button:rotate-180 data-flip-chevron-sm:rotate-180 group-data-[state=open]/button:data-flip-chevron-sm:rotate-360 sm:data-flip-chevron-sm:rotate-0 sm:group-data-[state=open]/button:data-flip-chevron-sm:rotate-180"
      />
    </Button>
  );
}
