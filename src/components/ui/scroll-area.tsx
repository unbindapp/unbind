"use client";

import * as React from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";

import { cn } from "@/components/ui/utils";

function ScrollArea({
  className,
  viewportRef,
  noFocusOnViewport,
  orientation = "vertical",
  classNameViewport,
  scrollBarClassName,
  children,
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Root> & {
  viewportRef?: React.Ref<HTMLDivElement>;
  classNameViewport?: string;
  scrollBarClassName?: string;
  orientation?: "vertical" | "horizontal";
  noFocusOnViewport?: boolean;
}) {
  return (
    <ScrollAreaPrimitive.Root
      className={cn(
        "group/root relative flex w-full flex-1 flex-col overflow-hidden [&>[data-radix-scroll-area-viewport]]:flex! data-[orientation=vertical]:[&>[data-radix-scroll-area-viewport]]:flex-col!",
        className,
      )}
      data-orientation={orientation}
      tabIndex={noFocusOnViewport ? -1 : undefined}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        ref={viewportRef}
        className={cn(
          "focus:outline-primary/50 w-full flex-1 rounded-[inherit] focus:outline-1 [&>div]:group-data-[orientation=horizontal]/root:flex! [&>div]:group-data-[orientation=vertical]/root:flex! [&>div]:group-data-[orientation=vertical]/root:flex-col!",
          classNameViewport,
        )}
        tabIndex={noFocusOnViewport ? -1 : undefined}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar className={scrollBarClassName} orientation={orientation} />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      orientation={orientation}
      className={cn(
        "group/scrollbar active:before:bg-muted-foreground/25 has-hover:hover:before:bg-muted-foreground/25 flex touch-none transition-[padding,background-color] select-none before:transition-colors",
        orientation === "vertical" &&
          "h-full w-4 border-l border-l-transparent p-px pl-[calc(1rem-2px-5px)] before:absolute before:top-0 before:right-0 before:h-full before:w-[11px] active:pl-[calc(1rem-2px-9px)] has-hover:hover:pl-[calc(1rem-2px-9px)]",
        orientation === "horizontal" &&
          "h-4 flex-col border-t border-t-transparent p-px pt-[calc(1rem-2px-5px)] before:absolute before:bottom-0 before:left-0 before:h-[11px] before:w-full active:pt-[calc(1rem-2px-9px)] has-hover:hover:pt-[calc(1rem-2px-9px)]",
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb className="bg-muted-more-foreground has-hover:group-hover/scrollbar:bg-muted-foreground group-active/scrollbar:bg-muted-foreground relative flex-1 rounded-full transition-colors" />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  );
}

export { ScrollArea, ScrollBar };
