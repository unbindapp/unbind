"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/components/ui/utils";
import { cva, VariantProps } from "class-variance-authority";
import { XIcon } from "lucide-react";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

export const dialogOverlayVariants = cva(
  "bg-barrier/barrier fixed inset-0 z-50 flex w-full justify-center overflow-auto px-2 pt-12 pb-[calc((100vh-3rem)*0.08+2rem)] data-no-x-padding:px-0 data-no-y-padding:py-0 md:pb-[calc((100vh-3rem)*0.1+3rem)]",
  {
    variants: {
      animate: {
        default:
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200 data-[state=closed]:duration-200 data-[state=open]:duration-200",
        none: "",
      },
    },
    defaultVariants: {
      animate: "default",
    },
  },
);

type TDialogOverlayVariants = VariantProps<typeof dialogOverlayVariants>;

function DialogOverlay({
  className,
  noXPadding,
  noYPadding,
  animate,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay> & {
  noXPadding?: boolean;
  noYPadding?: boolean;
} & TDialogOverlayVariants) {
  return (
    <DialogPrimitive.Overlay
      data-no-x-padding={noXPadding}
      data-no-y-padding={noYPadding}
      className={dialogOverlayVariants({ animate, className })}
      {...props}
    />
  );
}

export const dialogContentVariants = cva(
  "z-50 relative flex flex-col gap-5 w-auto max-w-full pointer-events-none my-auto outline-hidden focus:outline-hidden",
  {
    variants: {
      variant: {
        default: "bg-background border rounded-xl p-5 pt-4 shadow-dialog shadow-shadow/shadow",
        styleless: "",
      },
      animate: {
        default:
          "duration-200 data-[state=open]:duration-200 data-[state=closed]:duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-[95%] data-[state=open]:zoom-in-[95%] data-[state=closed]:slide-out-to-bottom-[5%] data-[state=open]:slide-in-from-bottom-[5%]",
        none: "",
      },
    },
    defaultVariants: {
      variant: "default",
      animate: "default",
    },
  },
);

export type TDialogContentVariants = VariantProps<typeof dialogContentVariants>;

function DialogContent({
  className,
  classNameInnerWrapper,
  variant,
  animate,
  children,
  onCloseAutoFocus,
  onEscapeKeyDown,
  noXPadding,
  noYPadding,
  hideXButton,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> &
  TDialogContentVariants & {
    classNameInnerWrapper?: string;
    noXPadding?: boolean;
    noYPadding?: boolean;
    hideXButton?: boolean;
  }) {
  const isCloseFromKey = React.useRef<boolean>(false);

  const handleCloseAutoFocus = React.useCallback(
    (e: Event) => {
      if (onCloseAutoFocus) {
        return onCloseAutoFocus(e);
      }

      if (isCloseFromKey.current) {
        isCloseFromKey.current = false;
        return;
      }

      e.preventDefault();
    },
    [onCloseAutoFocus],
  );

  const handleEscapeKeyDown = React.useCallback(
    (e: KeyboardEvent) => {
      isCloseFromKey.current = true;
      if (onEscapeKeyDown) {
        onEscapeKeyDown(e);
      }
    },
    [onEscapeKeyDown],
  );

  return (
    <DialogPortal>
      <DialogOverlay noYPadding={noYPadding} noXPadding={noXPadding} animate={animate}>
        <DialogPrimitive.Content
          {...props}
          onCloseAutoFocus={handleCloseAutoFocus}
          onEscapeKeyDown={handleEscapeKeyDown}
          className={dialogContentVariants({ variant, animate, className })}
        >
          <div className={cn("flex w-full flex-col gap-4", classNameInnerWrapper)}>
            {children}
            {!hideXButton && variant !== "styleless" && (
              <DialogPrimitive.Close className="focus-visible:ring-foreground text-muted-foreground absolute top-0 right-0 rounded-xl p-2.5 opacity-50 ring-1 ring-transparent focus-visible:outline-hidden active:opacity-100 disabled:pointer-events-none has-hover:hover:opacity-100">
                <XIcon className="h-5 w-5" />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogOverlay>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex w-full flex-col gap-2", className)} {...props} />;
}

function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
      {...props}
    />
  );
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn("pr-6 text-xl leading-tight font-bold", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn("text-muted-foreground leading-snug", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
