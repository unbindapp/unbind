"use client";

import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";

import { cn } from "@/components/ui/utils";

type DrawerContext = {
  hideHandle: boolean;
};

const DrawerContext = React.createContext<DrawerContext | null>(null);
const useDrawerContext = () => {
  const context = React.useContext(DrawerContext);
  if (!context) {
    throw new Error("useDrawerContext must be used within a Drawer");
  }
  return context;
};

function Drawer({
  shouldScaleBackground = false,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  const [hideHandle, setHideHandle] = React.useState(false);

  React.useEffect(() => {
    if (!props.open) {
      setHideHandle(true);
    } else {
      setHideHandle(false);
    }
  }, [props.open]);

  return (
    <DrawerContext.Provider value={{ hideHandle }}>
      <DrawerPrimitive.Root
        shouldScaleBackground={shouldScaleBackground}
        {...props}
      />
    </DrawerContext.Provider>
  );
}

const DrawerTrigger = DrawerPrimitive.Trigger;

const DrawerPortal = DrawerPrimitive.Portal;

const DrawerClose = DrawerPrimitive.Close;

function DrawerOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Overlay>) {
  return (
    <DrawerPrimitive.Overlay
      className={cn("fixed inset-0 z-50 bg-barrier/barrier", className)}
      {...props}
    />
  );
}

function DrawerContent({
  className,
  children,
  hasHandle = false,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Content> & {
  hasHandle?: boolean;
}) {
  const { hideHandle } = useDrawerContext();
  return (
    <DrawerPortal>
      <DrawerOverlay />
      <DrawerPrimitive.Content
        className={cn(
          `fixed inset-x-0 focus:outline-hidden focus-visible:outline-hidden bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-2xl bg-background ring-1 ring-border`,
          className
        )}
        {...props}
      >
        {hasHandle && (
          <div
            data-hide-handle={hideHandle ? true : undefined}
            className="w-[calc(min(33.3%,5rem))] data-hide-handle:-translate-y-6 transition duration-100 h-12 pb-2 
            -translate-y-full flex items-end justify-center absolute left-1/2 -translate-x-1/2 top-0"
          >
            <div className="w-full h-1.5 rounded-full bg-muted-more-foreground" />
          </div>
        )}
        {children}
      </DrawerPrimitive.Content>
    </DrawerPortal>
  );
}

function DrawerHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("grid gap-1.5 p-4 text-center sm:text-left", className)}
      {...props}
    />
  );
}

function DrawerFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  );
}

function DrawerTitle({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Title>) {
  return (
    <DrawerPrimitive.Title
      className={cn("text-lg font-semibold leading-tight", className)}
      {...props}
    />
  );
}

function DrawerDescription({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Description>) {
  return (
    <DrawerPrimitive.Description
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
};
