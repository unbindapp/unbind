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

const Drawer = ({
  shouldScaleBackground = false,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) => {
  const [hideHandle, setHideHandle] = React.useState(false);

  return (
    <DrawerContext.Provider value={{ hideHandle }}>
      <DrawerPrimitive.Root
        shouldScaleBackground={shouldScaleBackground}
        onOpenChange={(open) => {
          if (!open) {
            setHideHandle(true);
          } else {
            setHideHandle(false);
          }
          onOpenChange?.(open);
        }}
        {...props}
      />
    </DrawerContext.Provider>
  );
};
Drawer.displayName = "Drawer";

const DrawerTrigger = DrawerPrimitive.Trigger;

const DrawerPortal = DrawerPrimitive.Portal;

const DrawerClose = DrawerPrimitive.Close;

const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-barrier/[var(--opacity-barrier)]",
      className
    )}
    {...props}
  />
));
DrawerOverlay.displayName = DrawerPrimitive.Overlay.displayName;

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content> & {
    hasHandle?: boolean;
  }
>(({ className, children, hasHandle = false, ...props }, ref) => {
  const { hideHandle } = useDrawerContext();
  return (
    <DrawerPortal>
      <DrawerOverlay />
      <DrawerPrimitive.Content
        ref={ref}
        className={cn(
          `fixed inset-x-0 focus:outline-none focus-visible:outline-none bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-2xl bg-background ring-1 ring-border`,
          className
        )}
        {...props}
      >
        {hasHandle && (
          <div
            data-hide-handle={hideHandle ? true : undefined}
            className="w-[calc(min(33.3%,5rem))] data-[hide-handle]:-translate-y-6 transition duration-100 h-12 pb-2 
            -translate-y-full flex items-end justify-center absolute left-1/2 -translate-x-1/2 top-0"
          >
            <div className="w-full h-1.5 rounded-full bg-foreground/20" />
          </div>
        )}
        {children}
      </DrawerPrimitive.Content>
    </DrawerPortal>
  );
});
DrawerContent.displayName = "DrawerContent";

const DrawerHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("grid gap-1.5 p-4 text-center sm:text-left", className)}
    {...props}
  />
);
DrawerHeader.displayName = "DrawerHeader";

const DrawerFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("mt-auto flex flex-col gap-2 p-4", className)}
    {...props}
  />
);
DrawerFooter.displayName = "DrawerFooter";

const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-tight", className)}
    {...props}
  />
));
DrawerTitle.displayName = DrawerPrimitive.Title.displayName;

const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DrawerDescription.displayName = DrawerPrimitive.Description.displayName;

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
