import * as React from "react";
import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";

import { pressStartedInExemptElement } from "@/components/ui/press-origin";
import { cn } from "@/components/ui/utils";

type TDrawerDirection = "bottom" | "right";

type TDrawerContext = {
  hideHandle: boolean;
  direction: TDrawerDirection;
};

const DrawerContext = React.createContext<TDrawerContext | null>(null);
const useDrawerContext = () => {
  const context = React.useContext(DrawerContext);
  if (!context) {
    throw new Error("useDrawerContext must be used within a Drawer");
  }
  return context;
};

function Drawer({
  direction = "bottom",
  onOpenChange,
  ...props
}: Omit<DrawerPrimitive.Root.Props, "swipeDirection"> & {
  direction?: TDrawerDirection;
}) {
  const [hideHandle, setHideHandle] = React.useState(false);

  React.useEffect(() => {
    if (!props.open) {
      setHideHandle(true);
    } else {
      setHideHandle(false);
    }
  }, [props.open]);

  const handleOpenChange: DrawerPrimitive.Root.Props["onOpenChange"] = (open, eventDetails) => {
    // A press on a toast or the staged changes bar is not dismissing the drawer
    if (!open && eventDetails.reason === "outside-press") {
      if (pressStartedInExemptElement(eventDetails.event)) {
        eventDetails.cancel();
        return;
      }
    }
    onOpenChange?.(open, eventDetails);
  };

  return (
    <DrawerContext.Provider value={{ hideHandle, direction }}>
      <DrawerPrimitive.Root
        swipeDirection={direction === "bottom" ? "down" : "right"}
        onOpenChange={handleOpenChange}
        {...props}
      />
    </DrawerContext.Provider>
  );
}

function DrawerTrigger({ ...props }: DrawerPrimitive.Trigger.Props) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />;
}

function DrawerPortal({ ...props }: DrawerPrimitive.Portal.Props) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />;
}

function DrawerClose({ ...props }: DrawerPrimitive.Close.Props) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />;
}

// Matches vaul's feel: 500ms cubic-bezier(0.32, 0.72, 0, 1)
const drawerEase = "duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]";

function DrawerOverlay({
  className,
  transparent,
  ...props
}: DrawerPrimitive.Backdrop.Props & { transparent?: boolean }) {
  return (
    <DrawerPrimitive.Backdrop
      forceRender
      data-slot="drawer-overlay"
      className={cn(
        "fixed inset-0 z-50",
        !transparent &&
          cn(
            "bg-barrier/barrier opacity-[calc(1-var(--drawer-swipe-progress,0))] transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0 data-swiping:transition-none",
            drawerEase,
          ),
        className,
      )}
      {...props}
    />
  );
}

function DrawerContent({
  className,
  children,
  hasHandle = false,
  transparentOverlay,
  ...props
}: DrawerPrimitive.Popup.Props & {
  hasHandle?: boolean;
  transparentOverlay?: boolean;
}) {
  const { hideHandle, direction } = useDrawerContext();

  return (
    <DrawerPrimitive.VirtualKeyboardProvider>
      <DrawerPortal>
        <DrawerOverlay transparent={transparentOverlay} />
        <DrawerPrimitive.Viewport data-slot="drawer-viewport" className="fixed inset-0 z-50">
          <DrawerPrimitive.Popup
            data-slot="drawer-content"
            className={cn(
              "bg-background ring-border absolute z-50 flex flex-col ring-1 focus:outline-hidden focus-visible:outline-hidden",
              "pb-(--drawer-keyboard-inset,0px)",
              cn("transition-transform", drawerEase),
              "data-ending-style:duration-[calc(var(--drawer-swipe-strength,1)*500ms)]",
              direction === "bottom" &&
                cn(
                  "inset-x-0 bottom-0 mt-24 h-auto rounded-t-2xl data-ending-style:translate-y-full data-starting-style:translate-y-full",
                  // Fills the gap revealed below the sheet when it's overdragged upward
                  "after:absolute after:inset-x-0 after:top-full after:h-[50vh] after:bg-inherit",
                ),
              direction === "right" &&
                "top-0 right-0 h-full rounded-l-2xl data-ending-style:translate-x-full data-starting-style:translate-x-full",
              className,
            )}
            {...props}
          >
            {hasHandle && (
              <div
                aria-hidden
                data-hide-handle={hideHandle || undefined}
                className="bg-muted-more-foreground absolute top-0 left-1/2 h-1.5 w-[calc(min(33.3%,5rem))] -translate-x-1/2 -translate-y-3.5 rounded-full transition duration-100 data-hide-handle:translate-y-1.5"
              />
            )}
            <DrawerPrimitive.Content
              data-slot="drawer-content-inner"
              className="flex min-h-0 w-full flex-1 flex-col"
            >
              {children}
            </DrawerPrimitive.Content>
          </DrawerPrimitive.Popup>
        </DrawerPrimitive.Viewport>
      </DrawerPortal>
    </DrawerPrimitive.VirtualKeyboardProvider>
  );
}

function DrawerHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("grid gap-1.5 p-4 text-center sm:text-left", className)} {...props} />;
}

function DrawerFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-auto flex flex-col gap-2 p-4", className)} {...props} />;
}

function DrawerTitle({ className, ...props }: DrawerPrimitive.Title.Props) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn("text-lg leading-tight font-semibold", className)}
      {...props}
    />
  );
}

function DrawerDescription({ className, ...props }: DrawerPrimitive.Description.Props) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

function DrawerHeaderButtonsWrapper({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "-mt-2.25 -mr-3 flex items-center justify-end gap-1 sm:-mt-3 sm:-mr-5",
        className,
      )}
    >
      {children}
    </div>
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
  DrawerHeaderButtonsWrapper,
};
