import BottomDrawer from "@/components/bottom-drawer";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/utils";
import { ArrowRightIcon, CheckIcon, ChevronDownIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { ComponentProps, FC, useState } from "react";
import { useIsMounted, useWindowSize } from "usehooks-ts";

type Item<T> = T & { id: string; title: string };

type Props<T> = {
  title: string;
  selectedItem: Item<T> | undefined;
  items: Item<T>[] | undefined;
  onSelect: (id: string) => void;
  getHrefForId: (id: string) => string | null;
  IconItem?: FC<{ id: string }>;
  flipChevronOnSm?: boolean;
};

export function BreadcrumbItem<T>({
  title,
  selectedItem,
  items,
  onSelect,
  getHrefForId,
  IconItem,
  flipChevronOnSm,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { width } = useWindowSize();
  const isSmall = width < 640;
  const mounted = useIsMounted();

  if (isSmall && mounted()) {
    return (
      <BottomDrawer
        title={title}
        open={open}
        setOpen={setOpen}
        Trigger={<Trigger item={selectedItem} Icon={IconItem} />}
      >
        <div className="w-full flex flex-col px-2 pt-2 pb-8">
          {items?.map((i, index) => {
            const href = getHrefForId(i.id);
            const showArrow = href !== null && pathname !== href;
            return (
              <Button
                onClick={() => {
                  setOpen(false);
                  onSelect(i.id);
                }}
                data-selected={selectedItem?.id === i.id ? true : undefined}
                key={i.id + index}
                data-show-arrow={showArrow ? true : undefined}
                variant="ghost"
                className="w-full data-[selected]:bg-border/50 data-[selected]:has-hover:hover:bg-border data-[selected]:active:bg-border 
                text-left px-3 py-3.5 rounded-lg font-medium flex items-center justify-between gap-3 group/item"
              >
                <div className="flex-1 min-w-0 flex items-center gap-2.5">
                  {IconItem && <IconItem id={i.id} />}
                  <p className="shrink min-w-0">{i.title}</p>
                </div>
                <div className="size-5 -mr-0.5 relative">
                  {selectedItem?.id === i.id && (
                    <>
                      <CheckIcon
                        className="size-full group-data-[show-arrow]/item:group-data-[highlighted]/item:opacity-0 
                        group-data-[show-arrow]/item:group-data-[highlighted]/item:rotate-90 transition"
                        strokeWidth={2.5}
                      />
                      <ArrowRightIcon
                        className="absolute left-0 top-0 opacity-0 -rotate-90 size-full 
                        group-data-[show-arrow]/item:group-data-[highlighted]/item:opacity-100
                        group-data-[show-arrow]/item:group-data-[highlighted]/item:rotate-0 transition"
                        strokeWidth={2.5}
                      />
                    </>
                  )}
                </div>
              </Button>
            );
          })}
        </div>
      </BottomDrawer>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Trigger
          item={selectedItem}
          Icon={IconItem}
          flipChevronOnSm={flipChevronOnSm}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        sideOffset={-1}
        align="start"
        className="group/content"
      >
        <ScrollArea className="p-1">
          {items?.map((i, index) => {
            const href = getHrefForId(i.id);
            const showArrow = href !== null && pathname !== href;
            return (
              <DropdownMenuItem
                onSelect={() => {
                  setOpen(false);
                  onSelect(i.id);
                }}
                key={i.id + index}
                data-show-arrow={showArrow ? true : undefined}
                className="justify-between group/item"
              >
                <div className="flex-1 min-w-0 flex items-center gap-2.5">
                  {IconItem && <IconItem id={i.id} />}
                  <p className="shrink min-w-0">{i.title}</p>
                </div>
                <div className="size-4 -mr-0.5 relative group-data-[show-arrow]/item:group-data-[highlighted]/item:rotate-90 transition-transform">
                  {selectedItem?.id === i.id && (
                    <>
                      <CheckIcon
                        className="size-full group-data-[show-arrow]/item:group-data-[highlighted]/item:opacity-0 transition-opacity"
                        strokeWidth={3}
                      />
                      <ArrowRightIcon
                        className="absolute left-0 top-0 opacity-0 -rotate-90 size-full group-data-[show-arrow]/item:group-data-[highlighted]/item:opacity-100 transition-opacity"
                        strokeWidth={2.5}
                      />
                    </>
                  )}
                </div>
              </DropdownMenuItem>
            );
          })}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
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
  Icon?: FC<{ id: string; className?: string }>;
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
        `px-1.5 py-4 data-[no-icon]:pl-2.75 rounded border-none font-medium flex items-center justify-start gap-2 
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
        className="group-data-[pending]/button:text-transparent group-data-[pending]/button:bg-foreground 
          group-data-[pending]/button:rounded-sm group-data-[pending]/button:animate-skeleton max-w-32 whitespace-nowrap 
          leading-none overflow-hidden overflow-ellipsis relative"
      >
        {item == undefined ? "Loading" : item?.title}
      </p>
      <ChevronDownIcon
        data-flip-chevron-sm={flipChevronOnSm ? true : undefined}
        className="size-4 -my-1 relative -ml-1 text-muted-more-foreground group-data-[state=open]/button:rotate-180 
        data-[flip-chevron-sm]:rotate-180 data-[flip-chevron-sm]:group-data-[state=open]/button:rotate-360 
        sm:data-[flip-chevron-sm]:rotate-0 sm:data-[flip-chevron-sm]:group-data-[state=open]/button:rotate-180 transition"
      />
    </Button>
  );
}
