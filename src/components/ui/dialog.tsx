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

function DialogOverlay({
  className,
  noXPadding,
  noYPadding,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay> & {
  noXPadding?: boolean;
  noYPadding?: boolean;
}) {
  return (
    <DialogPrimitive.Overlay
      data-no-x-padding={noXPadding}
      data-no-y-padding={noYPadding}
      className={cn(
        "bg-barrier/barrier data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 flex w-full justify-center overflow-auto px-2 pt-12 pb-[calc((100vh-3rem)*0.08+2rem)] duration-200 data-no-x-padding:px-0 data-no-y-padding:py-0 data-[state=closed]:duration-200 data-[state=open]:duration-200 md:pb-[calc((100vh-3rem)*0.1+3rem)]",
        className,
      )}
      {...props}
    />
  );
}

const dialogContentVariants = cva(
  "z-50 relative flex flex-col gap-5 w-auto max-w-full pointer-events-none duration-200 data-[state=open]:duration-200 data-[state=closed]:duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-bottom-[6%] data-[state=open]:slide-in-from-bottom-[6%]",
  {
    variants: {
      variant: {
        default: "bg-background border rounded-xl p-5 pt-4 shadow-dialog shadow-shadow/shadow",
        styleless: "",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function DialogContent({
  className,
  classNameInnerWrapper,
  variant,
  children,
  onCloseAutoFocus,
  onEscapeKeyDown,
  noXPadding,
  noYPadding,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> &
  VariantProps<typeof dialogContentVariants> & {
    classNameInnerWrapper?: string;
    noXPadding?: boolean;
    noYPadding?: boolean;
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
      <DialogOverlay noYPadding={noYPadding} noXPadding={noXPadding}>
        <DialogPrimitive.Content
          onCloseAutoFocus={handleCloseAutoFocus}
          onEscapeKeyDown={handleEscapeKeyDown}
          className={cn(
            "my-auto w-auto outline-hidden focus:outline-hidden",
            dialogContentVariants({ variant }),
            className,
          )}
          {...props}
        >
          <div className={cn("flex w-full flex-col gap-4", classNameInnerWrapper)}>
            {children}
            {variant !== "styleless" && (
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
  return <div className={cn("flex w-full flex-col gap-1", className)} {...props} />;
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
