"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { cn } from "@/components/ui/utils";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";

const Select = SelectPrimitive.Root;

function SelectGroup({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Group> & {
  inset?: boolean;
}) {
  return (
    <SelectPrimitive.Group className={cn("p-1", className)} {...props}>
      {children}
    </SelectPrimitive.Group>
  );
}

const SelectValue = SelectPrimitive.Value;

function SelectTrigger({
  className,
  classNameInnerContainer,
  children,
  hideChevron = false,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  hideChevron?: boolean;
  classNameInnerContainer?: string;
}) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        "flex px-3 font-bold gap-1 relative group/trigger before:w-full before:h-full before:min-w-[48px] before:min-h-[48px] before:left-1/2 before:top-1/2 before:-translate-x-1/2 before:-translate-y-1/2 before:z-[-1] select-none z-0 before:bg-transparent before:absolute touch-manipulation items-center justify-between whitespace-nowrap rounded-lg has-hover:hover:bg-border active:bg-border border bg-transparent leading-tight py-1.5 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-hidden focus-visible:ring-1 focus-visible:ring-offset-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
        className
      )}
      {...props}
    >
      <div
        className={cn(
          "shrink min-w-0 truncate gap-1.5 flex",
          classNameInnerContainer
        )}
      >
        {children}
      </div>
      {!hideChevron && (
        <SelectPrimitive.Icon asChild>
          <ChevronDownIcon className="size-4 -my-1 -mr-1.25 shrink-0 text-muted-more-foreground group-data-[state=open]/trigger:rotate-180 transition-transform" />
        </SelectPrimitive.Icon>
      )}
    </SelectPrimitive.Trigger>
  );
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton
      className={cn(
        "flex cursor-default items-center justify-center py-1",
        className
      )}
      {...props}
    >
      <ChevronUpIcon className="size-4 text-muted-more-foreground -my-1" />
    </SelectPrimitive.ScrollUpButton>
  );
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton
      className={cn(
        "flex cursor-default items-center justify-center py-1",
        className
      )}
      {...props}
    >
      <ChevronDownIcon className="size-4 text-muted-more-foreground -my-1" />
    </SelectPrimitive.ScrollDownButton>
  );
}

function SelectContent({
  className,
  children,
  onPointerDownOutside,
  onPointerDown,
  onCloseAutoFocus,
  collisionPadding = {
    top: 16,
    bottom: 16,
    left: 8,
    right: 8,
  },
  position = "popper",
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  const isCloseFromMouse = React.useRef<boolean>(false);

  const handlePointerDownOutside = React.useCallback(
    (e: unknown) => {
      isCloseFromMouse.current = true;
      // @ts-expect-error - they don't export the PointerDownOutsideEvent
      onPointerDownOutside?.(e);
    },
    [onPointerDownOutside]
  );

  const handlePointerDown = React.useCallback(
    (e: unknown) => {
      isCloseFromMouse.current = true;
      // @ts-expect-error - they don't export the PointerDownEvent
      onPointerDown?.(e);
    },
    [onPointerDown]
  );

  const handleCloseAutoFocus = React.useCallback(
    (e: Event) => {
      if (onCloseAutoFocus) {
        return onCloseAutoFocus(e);
      }

      if (!isCloseFromMouse.current) {
        return;
      }

      e.preventDefault();
      isCloseFromMouse.current = false;
    },
    [onCloseAutoFocus]
  );

  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        onPointerDownOutside={handlePointerDownOutside}
        onPointerDown={handlePointerDown}
        onCloseAutoFocus={handleCloseAutoFocus}
        collisionPadding={collisionPadding}
        className={cn(
          "max-w-[var(--radix-popper-available-width)] max-h-[min(20rem,var(--radix-popper-available-height))] relative shadow-lg shadow-shadow-color/shadow-opacity z-50 overflow-hidden rounded-lg border bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          position === "popper" &&
            "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
          className
        )}
        position={position}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn(
            position === "popper" &&
              "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)-2px)]"
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

function SelectLabel({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      className={cn("px-2 py-1.5 text-sm font-semibold", className)}
      {...props}
    />
  );
}

function SelectItem({
  className,
  children,
  hideTick = false,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item> & {
  hideTick?: boolean;
}) {
  return (
    <SelectPrimitive.Item
      className={cn(
        "relative w-full cursor-default font-medium select-none items-center pl-2 pr-8 rounded-md py-2 leading-tight outline-hidden focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50",
        hideTick && "px-2",
        className
      )}
      {...props}
    >
      {!hideTick && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 flex size-4 items-center justify-center">
          <SelectPrimitive.ItemIndicator>
            <CheckIcon strokeWidth={2.5} className="size-full" />
          </SelectPrimitive.ItemIndicator>
        </span>
      )}
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      className={cn("-mx-1 my-1 h-px bg-muted", className)}
      {...props}
    />
  );
}

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
};
