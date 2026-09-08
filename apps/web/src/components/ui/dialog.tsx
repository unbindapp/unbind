import * as React from "react";
import { pressStartedInExemptElement } from "@/components/ui/press-origin";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

import { cn } from "@/components/ui/utils";
import { cva, VariantProps } from "class-variance-authority";
import { XIcon } from "lucide-react";

const createDialogHandle = DialogPrimitive.createHandle;
export type TDialogHandle = DialogPrimitive.Handle<unknown>;

function Dialog({ onOpenChange, ...props }: DialogPrimitive.Root.Props) {
  const handleOpenChange: DialogPrimitive.Root.Props["onOpenChange"] = (open, eventDetails) => {
    // A press on a toast or the staged changes bar is not dismissing the dialog
    if (!open && eventDetails.reason === "outside-press") {
      if (pressStartedInExemptElement(eventDetails.event)) {
        eventDetails.cancel();
        return;
      }
    }
    onOpenChange?.(open, eventDetails);
  };
  return <DialogPrimitive.Root data-slot="dialog" onOpenChange={handleOpenChange} {...props} />;
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

// The staged changes bar sits at z-900. A dialog that edits what the bar deploys
// stays below it so the bar remains usable, like it is above drawers.
const dialogLayerVariants = {
  default: "z-[1000]",
  "below-changes-bar": "z-[899]",
};

const dialogOverlayVariants = cva("bg-barrier/barrier fixed inset-0", {
  variants: {
    layer: dialogLayerVariants,
    animate: {
      default:
        "data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 duration-200 data-closed:duration-200 data-open:duration-200",
      false: "",
    },
  },
  defaultVariants: {
    layer: "default",
    animate: "default",
  },
});

type TDialogOverlayVariants = VariantProps<typeof dialogOverlayVariants>;

function DialogOverlay({
  className,
  animate,
  layer,
  ...props
}: DialogPrimitive.Backdrop.Props & TDialogOverlayVariants) {
  return (
    <DialogPrimitive.Backdrop
      forceRender
      data-slot="dialog-overlay"
      className={cn(dialogOverlayVariants({ animate, layer, className }))}
      {...props}
    />
  );
}

const dialogViewportVariants = cva(
  "fixed inset-0 flex w-full justify-center overflow-auto px-2 pt-[var(--dialog-top-padding)] sm:pt-[var(--dialog-top-padding-sm)]",
  {
    variants: {
      layer: dialogLayerVariants,
      avoidKeyboard: {
        true: "pb-[calc(var(--dialog-bottom-padding)+var(--keyboard-inset-height))] sm:pb-[calc(var(--dialog-bottom-padding-sm)+var(--keyboard-inset-height))]",
        false: "pb-[var(--dialog-bottom-padding)] sm:pb-[var(--dialog-bottom-padding-sm)]",
      },
    },
    defaultVariants: {
      layer: "default",
      avoidKeyboard: false,
    },
  },
);

export const dialogContentVariants = cva(
  "relative z-50 my-auto flex w-auto max-w-full flex-col gap-5 outline-hidden focus:outline-hidden",
  {
    variants: {
      variant: {
        default:
          "bg-background shadow-dialog shadow-shadow-color/shadow-opacity rounded-xl border p-5 pt-3.5",
        styleless: "",
      },
      animate: {
        default:
          "duration-200 data-open:duration-200 data-closed:duration-200 data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-[95%] data-open:zoom-in-[95%] data-closed:slide-out-to-bottom-[5%] data-open:slide-in-from-bottom-[5%]",
        false: "",
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
  hideXButton,
  avoidKeyboard,
  layer,
  ...props
}: DialogPrimitive.Popup.Props &
  TDialogContentVariants & {
    classNameInnerWrapper?: string;
    hideXButton?: boolean;
    avoidKeyboard?: boolean;
    layer?: keyof typeof dialogLayerVariants;
  }) {
  return (
    <DialogPortal>
      <DialogOverlay animate={animate} layer={layer} />
      <DialogPrimitive.Viewport
        data-slot="dialog-viewport"
        className={cn(dialogViewportVariants({ avoidKeyboard, layer }))}
      >
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          className={cn(dialogContentVariants({ variant, animate, className }))}
          {...props}
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
        </DialogPrimitive.Popup>
      </DialogPrimitive.Viewport>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex w-full flex-col items-start gap-2", className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
      {...props}
    />
  );
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("max-w-full pr-6 text-xl leading-tight font-semibold", className)}
      {...props}
    />
  );
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  createDialogHandle,
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
