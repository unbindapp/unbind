import { Toast as ToastPrimitive } from "@base-ui/react/toast";
import {
  CheckCircleIcon,
  CircleAlertIcon,
  InfoIcon,
  LoaderIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";

type TToastData = {
  icon?: React.ReactNode;
  action?: React.ReactNode;
};

const toast = ToastPrimitive.createToastManager<TToastData>();

function ToastPortal({ ...props }: ToastPrimitive.Portal.Props) {
  return <ToastPrimitive.Portal data-slot="toast-portal" {...props} />;
}

function ToastViewport({ className, ...props }: ToastPrimitive.Viewport.Props) {
  return (
    <ToastPrimitive.Viewport
      data-slot="toast-viewport"
      className={cn(
        "pointer-events-none fixed inset-x-4 bottom-4 z-2000 mx-auto w-auto max-w-sm font-sans outline-none sm:right-4 sm:left-auto sm:mx-0 sm:w-full",
        className,
      )}
      {...props}
    />
  );
}

function Toast({ className, ...props }: ToastPrimitive.Root.Props) {
  return (
    <ToastPrimitive.Root
      data-slot="toast"
      className={cn(
        "group/toast border-border bg-background text-foreground shadow-shadow-color/shadow-opacity pointer-events-auto absolute right-0 bottom-0 z-[calc(1000-var(--toast-index))] w-full origin-bottom rounded-xl border shadow-lg will-change-transform outline-none select-none",
        "[--gap:0.75rem] [--height:var(--toast-frontmost-height,var(--toast-height))] [--offset-y:calc(var(--toast-offset-y)*-1+calc(var(--toast-index)*var(--gap)*-1)+var(--toast-swipe-movement-y))] [--peek:0.75rem] [--scale:calc(max(0,1-(var(--toast-index)*0.1)))] [--shrink:calc(1-var(--scale))]",
        "h-(--height) [transform:translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)-(var(--toast-index)*var(--peek))-(var(--shrink)*var(--height))))_scale(var(--scale))] [transition:transform_500ms_cubic-bezier(0.22,1,0.36,1),opacity_500ms,height_150ms]",
        "after:absolute after:top-full after:left-0 after:h-[calc(var(--gap)+1px)] after:w-full after:content-['']",
        "data-expanded:h-(--toast-height) data-expanded:[transform:translateX(var(--toast-swipe-movement-x))_translateY(var(--offset-y))]",
        "data-limited:opacity-0 data-starting-style:[transform:translateY(150%)]",
        "[&[data-ending-style]:not([data-limited]):not([data-swipe-direction])]:[transform:translateY(150%)]",
        "data-ending-style:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-movement-y)+150%))]",
        "data-ending-style:data-[swipe-direction=left]:[transform:translateX(calc(var(--toast-swipe-movement-x)-150%))_translateY(var(--offset-y))]",
        "data-ending-style:data-[swipe-direction=right]:[transform:translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))]",
        "data-ending-style:data-[swipe-direction=up]:[transform:translateY(calc(var(--toast-swipe-movement-y)-150%))]",
        "data-expanded:data-ending-style:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-movement-y)+150%))]",
        "data-expanded:data-ending-style:data-[swipe-direction=left]:[transform:translateX(calc(var(--toast-swipe-movement-x)-150%))_translateY(var(--offset-y))]",
        "data-expanded:data-ending-style:data-[swipe-direction=right]:[transform:translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))]",
        "data-expanded:data-ending-style:data-[swipe-direction=up]:[transform:translateY(calc(var(--toast-swipe-movement-y)-150%))]",
        className,
      )}
      {...props}
    />
  );
}

function ToastContent({ className, ...props }: ToastPrimitive.Content.Props) {
  return (
    <ToastPrimitive.Content
      data-slot="toast-content"
      className={cn(
        "flex h-full gap-2 overflow-hidden px-4 py-3.5 pr-12 transition-opacity duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] data-behind:opacity-0 data-expanded:opacity-100",
        className,
      )}
      {...props}
    />
  );
}

function ToastTitle({ className, ...props }: ToastPrimitive.Title.Props) {
  return (
    <ToastPrimitive.Title
      data-slot="toast-title"
      className={cn(
        "text-foreground group-data-[type=error]/toast:text-destructive group-data-[type=success]/toast:text-success group-data-[type=warning]/toast:text-warning -mt-px leading-tight font-semibold",
        className,
      )}
      {...props}
    />
  );
}

function ToastDescription({ className, ...props }: ToastPrimitive.Description.Props) {
  return (
    <ToastPrimitive.Description
      data-slot="toast-description"
      className={cn(
        "text-muted-foreground group-data-[type=error]/toast:text-foreground group-data-[type=success]/toast:text-foreground group-data-[type=warning]/toast:text-foreground text-sm leading-snug",
        className,
      )}
      {...props}
    />
  );
}

function ToastClose({ className, ...props }: ToastPrimitive.Close.Props) {
  return (
    <ToastPrimitive.Close
      data-slot="toast-close"
      aria-label="Close toast"
      className={cn("text-muted-more-foreground absolute top-1 right-1", className)}
      render={
        <Button variant="ghost" size="icon">
          <XIcon className="size-4.5" />
        </Button>
      }
      {...props}
    ></ToastPrimitive.Close>
  );
}

const toastIcons: Record<string, React.ReactNode> = {
  success: <CheckCircleIcon className="size-full" />,
  info: <InfoIcon className="size-full" />,
  warning: <CircleAlertIcon className="size-full" />,
  error: <TriangleAlertIcon className="size-full" />,
  loading: <LoaderIcon className="size-full animate-spin" />,
};

function ToastIcon({ icon, type }: { icon: React.ReactNode; type: string | undefined }) {
  const resolvedIcon = icon ?? (type ? toastIcons[type] : null);
  if (!resolvedIcon) return null;

  return (
    <span
      data-slot="toast-icon"
      className="text-foreground group-data-[type=error]/toast:text-destructive group-data-[type=success]/toast:text-success group-data-[type=warning]/toast:text-warning mt-0.5 size-4 shrink-0 [&_svg]:pointer-events-none"
    >
      {resolvedIcon}
    </span>
  );
}

function ToastList() {
  const { toasts } = ToastPrimitive.useToastManager<TToastData>();

  return toasts.map((toastItem) => (
    <Toast key={toastItem.id} toast={toastItem}>
      <ToastContent>
        <ToastIcon icon={toastItem.data?.icon} type={toastItem.type} />
        <div className="flex w-full min-w-0 shrink flex-col items-start justify-start gap-2.5">
          <div className="flex w-full min-w-0 shrink flex-col gap-1">
            <ToastTitle />
            <ToastDescription />
          </div>
          {toastItem.data?.action && (
            <div className="flex w-full pb-0.5">{toastItem.data?.action}</div>
          )}
        </div>
        <ToastClose />
      </ToastContent>
    </Toast>
  ));
}

function Toaster({ toastManager = toast, timeout = 0, ...props }: ToastPrimitive.Provider.Props) {
  return (
    <ToastPrimitive.Provider toastManager={toastManager} timeout={timeout} {...props}>
      <ToastPortal>
        <ToastViewport>
          <ToastList />
        </ToastViewport>
      </ToastPortal>
    </ToastPrimitive.Provider>
  );
}

export { toast, Toaster };
