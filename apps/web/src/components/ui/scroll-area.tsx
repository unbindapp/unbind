import * as React from "react";
import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";

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
}: ScrollAreaPrimitive.Root.Props & {
  viewportRef?: React.Ref<HTMLDivElement>;
  classNameViewport?: string;
  scrollBarClassName?: string;
  orientation?: "vertical" | "horizontal";
  noFocusOnViewport?: boolean;
}) {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      data-orientation={orientation}
      className={cn("group/root relative flex w-full flex-1 flex-col overflow-hidden", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        ref={viewportRef}
        className={cn(
          "focus:outline-primary/50 flex w-full flex-1 rounded-[inherit] focus:outline-1",
          orientation === "vertical" && "flex-col",
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
}: ScrollAreaPrimitive.Scrollbar.Props) {
  return (
    <ScrollAreaPrimitive.Scrollbar
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      className={cn(
        "group/scrollbar active:before:bg-muted-foreground/25 has-hover:hover:before:bg-muted-foreground/25 flex touch-none transition-[padding,background-color] select-none before:transition-colors",
        orientation === "vertical" &&
          "h-full w-4 border-l border-l-transparent p-px pl-[calc(1rem-2px-5px)] before:absolute before:top-0 before:right-0 before:h-full before:w-2.75 active:pl-[calc(1rem-2px-9px)] has-hover:hover:pl-[calc(1rem-2px-9px)]",
        orientation === "horizontal" &&
          "h-4 flex-col border-t border-t-transparent p-px pt-[calc(1rem-2px-5px)] before:absolute before:bottom-0 before:left-0 before:h-2.75 before:w-full active:pt-[calc(1rem-2px-9px)] has-hover:hover:pt-[calc(1rem-2px-9px)]",
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb
        data-slot="scroll-area-thumb"
        className="bg-muted-more-foreground has-hover:group-hover/scrollbar:bg-muted-foreground group-active/scrollbar:bg-muted-foreground relative flex-1 rounded-full transition-colors"
      />
    </ScrollAreaPrimitive.Scrollbar>
  );
}

export { ScrollArea, ScrollBar };
