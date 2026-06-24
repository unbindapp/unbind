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
  transparent,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Overlay> & { transparent?: boolean }) {
  return (
    <DrawerPrimitive.Overlay
      className={cn("fixed inset-0 z-50", !transparent && "bg-barrier/barrier", className)}
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
}: React.ComponentProps<typeof DrawerPrimitive.Content> & {
  hasHandle?: boolean;
  transparentOverlay?: boolean;
}) {
  const { hideHandle } = useDrawerContext();

  // Radix dropdowns/selects/popovers render their content in a portal outside
  // the drawer's DOM, so dismissing one with an outside click also reaches the
  // drawer's dismissable layer and closes it. If such a popper is open, the
  // click belongs to it (it's the top-most layer) and the drawer must stay open.
  // We can't detect this inside `onPointerDownOutside`: vaul reports it deferred
  // (on the `click`), by which point the popper has already closed/unmounted. So
  // we record whether a popper was open at `pointerdown`, while it's still mounted.
  const popperWasOpenOnPointerDownRef = React.useRef(false);
  React.useEffect(() => {
    const onPointerDown = () => {
      popperWasOpenOnPointerDownRef.current =
        document.querySelector("[data-radix-popper-content-wrapper]") !== null;
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, []);

  return (
    <DrawerPortal>
      <DrawerOverlay transparent={transparentOverlay} />
      <DrawerPrimitive.Content
        onPointerDownOutside={(e) => {
          const target = e.detail.originalEvent.target;
          if (
            popperWasOpenOnPointerDownRef.current ||
            (target instanceof Element && target.closest("[data-sonner-toast]"))
          ) {
            e.preventDefault();
          }
        }}
        className={cn(
          `bg-background ring-border fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-2xl ring-1 focus:outline-hidden focus-visible:outline-hidden`,
          className,
        )}
        {...props}
      >
        {hasHandle && (
          <DrawerPrimitive.Handle
            data-hide-handle={hideHandle || undefined}
            className="bg-muted-more-foreground! absolute! left-1/2 h-1.5! w-[calc(min(33.3%,5rem))]! -translate-x-1/2 -translate-y-3.5! opacity-100! transition duration-100! data-hide-handle:translate-y-1.5!"
          ></DrawerPrimitive.Handle>
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
