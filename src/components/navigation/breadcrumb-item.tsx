"use client";

import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/utils";
import {
  ArrowRightIcon,
  CheckIcon,
  ChevronDownIcon,
  SlashIcon,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { FC, JSX, ReactNode, useState } from "react";

export function BreadcrumbWrapper({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex items-center justify-start", className)}>
      {children}
    </div>
  );
}

export function BreadcrumbSeparator({ className }: { className?: string }) {
  return (
    <SlashIcon
      className={cn(
        "text-foreground/16 -mx-0.5 sm:mx-0 -rotate-30 size-4 shrink-0",
        className
      )}
      strokeWidth={3}
    />
  );
}

export function BreadcrumbItem<T extends { id: string; title: string }>({
  selectedItem,
  items,
  onSelect,
  Icon,
  getHrefForId,
  IconItem,
}: {
  selectedItem: T | undefined;
  items: T[] | undefined;
  onSelect: (id: string) => void;
  Icon?: JSX.Element;
  getHrefForId: (id: string) => string | null;
  IconItem?: FC<{ id: string }>;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        data-no-icon={Icon === undefined ? true : undefined}
        className={cn(
          buttonVariants({
            variant: "ghost",
            size: "sm",
            forceMinSize: false,
          }),
          "px-1.5 py-1.75 data-[no-icon]:pl-2.75 rounded-lg border-none font-medium flex items-center justify-start gap-2 not-touch:hover:bg-border text-sm group/trigger"
        )}
      >
        {IconItem && selectedItem && <IconItem id={selectedItem.id} />}
        <p>{selectedItem?.title}</p>
        <ChevronDownIcon className="size-4 -ml-1 text-muted-more-foreground group-data-[state=open]/trigger:rotate-180 transition" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="group/content">
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
                className="py-2 flex items-center justify-between gap-2.5 group/item"
              >
                <div className="flex-1 min-w-0 flex items-center gap-2.5">
                  {IconItem && <IconItem id={i.id} />}
                  <p className="shrink min-w-0">{i.title}</p>
                </div>
                <div className="size-4 -mr-0.5 relative">
                  {selectedItem?.id === i.id && (
                    <>
                      <CheckIcon
                        className="size-full group-data-[show-arrow]/item:group-data-[highlighted]/item:opacity-0 group-data-[show-arrow]/item:group-data-[highlighted]/item:rotate-90 transition"
                        strokeWidth={3}
                      />
                      <ArrowRightIcon
                        className="absolute left-0 top-0 opacity-0 -rotate-90 size-full group-data-[show-arrow]/item:group-data-[highlighted]/item:opacity-100
                        group-data-[show-arrow]/item:group-data-[highlighted]/item:rotate-0 transition"
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
