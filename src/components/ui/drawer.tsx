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
      <DrawerPrimitive.Root shouldScaleBackground={shouldScaleBackground} {...props} />
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
      className={cn("bg-barrier/barrier fixed inset-0 z-50", className)}
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
          `bg-background ring-border fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-2xl ring-1 focus:outline-hidden focus-visible:outline-hidden`,
          className,
        )}
        {...props}
      >
        {hasHandle && (
          <div
            data-hide-handle={hideHandle ? true : undefined}
            className="absolute top-0 left-1/2 flex h-12 w-[calc(min(33.3%,5rem))] -translate-x-1/2 -translate-y-full items-end justify-center pb-2 transition duration-100 data-hide-handle:-translate-y-6"
          >
            <div className="bg-muted-more-foreground h-1.5 w-full rounded-full" />
          </div>
        )}
        {children}
      </DrawerPrimitive.Content>
    </DrawerPortal>
  );
}

function DrawerHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("grid gap-1.5 p-4 text-center sm:text-left", className)} {...props} />;
}

function DrawerFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-auto flex flex-col gap-2 p-4", className)} {...props} />;
}

function DrawerTitle({ className, ...props }: React.ComponentProps<typeof DrawerPrimitive.Title>) {
  return (
    <DrawerPrimitive.Title
      className={cn("text-lg leading-tight font-semibold", className)}
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
      className={cn("text-muted-foreground text-sm", className)}
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
