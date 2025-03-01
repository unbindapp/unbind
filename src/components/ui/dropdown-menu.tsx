"use client";

import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "@/components/ui/utils";
import { ChevronRightIcon, DotFilledIcon } from "@radix-ui/react-icons";
import { CheckIcon } from "lucide-react";

function DropdownMenu({
  modal = true,
  ...rest
}: DropdownMenuPrimitive.DropdownMenuProps) {
  return <DropdownMenuPrimitive.Root modal={modal} {...rest} />;
}

function DropdownMenuTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger> & {
  inset?: boolean;
}) {
  return (
    <DropdownMenuPrimitive.Trigger className={cn(className)} {...props}>
      {children}
    </DropdownMenuPrimitive.Trigger>
  );
}

function DropdownMenuGroup({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Group> & {
  inset?: boolean;
}) {
  return (
    <DropdownMenuPrimitive.Group className={cn("p-1", className)} {...props}>
      {children}
    </DropdownMenuPrimitive.Group>
  );
}

const DropdownMenuPortal = DropdownMenuPrimitive.Portal;

const DropdownMenuSub = DropdownMenuPrimitive.Sub;

const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & {
  inset?: boolean;
}) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      className={cn(
        "flex cursor-default gap-2 select-none items-center rounded-sm px-2 py-1.5 text-sm outline-hidden focus:bg-accent data-[state=open]:bg-accent [&_svg]:pointer-events-none [&_svg]:shrink-0",
        inset && "pl-8",
        className
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto" />
    </DropdownMenuPrimitive.SubTrigger>
  );
}

function DropdownMenuSubContent({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubContent>) {
  return (
    <DropdownMenuPrimitive.SubContent
      className={cn(
        "z-50 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  );
}

function DropdownMenuContent({
  className,
  sideOffset = 4,
  onPointerDownOutside,
  collisionPadding = {
    top: 16,
    bottom: 16,
    left: 8,
    right: 8,
  },
  onPointerDown,
  onCloseAutoFocus,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
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
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        onPointerDownOutside={handlePointerDownOutside}
        onPointerDown={handlePointerDown}
        onCloseAutoFocus={handleCloseAutoFocus}
        collisionPadding={collisionPadding}
        className={cn(
          "z-999 max-w-[var(--radix-popper-available-width)] max-h-[min(30rem,var(--radix-popper-available-height))] flex flex-col overflow-hidden rounded-lg border bg-popover p-0 text-popover-foreground shadow-lg shadow-shadow/shadow",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          className
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

function DropdownMenuItem({
  className,
  fadeOnDisabled = true,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  inset?: boolean;
  fadeOnDisabled?: boolean;
}) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        "relative leading-tight flex font-medium cursor-default select-none justify-start items-center gap-2.5 rounded-md px-2.5 py-2.25 outline-hidden active:bg-accent focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none [&>svg]:shrink-0",
        fadeOnDisabled && "data-disabled:opacity-50",
        inset && "pl-8",
        className
      )}
      {...props}
    />
  );
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  onSelect,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      className={cn(
        "relative group/checkbox flex leading-tight font-medium cursor-default select-none justify-start items-center rounded-md py-2.25 pl-9.5 pr-3.5 outline-hidden focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50",
        className
      )}
      checked={checked}
      data-checked={checked ? true : undefined}
      onSelect={
        onSelect
          ? onSelect
          : (e) => {
              e.preventDefault();
            }
      }
      {...props}
    >
      <span
        className="absolute left-2.5 flex items-center justify-center shrink-0 size-4.5 border 
      border-muted-more-foreground rounded-sm p-0.25 group-data-checked/checkbox:bg-foreground group-data-checked/checkbox:text-background
      group-data-checked/checkbox:border-foreground"
      >
        <DropdownMenuPrimitive.ItemIndicator className="size-full">
          <CheckIcon strokeWidth={3} className="size-full" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  );
}

function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
  return (
    <DropdownMenuPrimitive.RadioItem
      className={cn(
        "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-hidden focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <DotFilledIcon className="h-2 w-2 fill-current" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  );
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label> & {
  inset?: boolean;
}) {
  return (
    <DropdownMenuPrimitive.Label
      className={cn(
        "px-3.5 py-1.75 text-sm font-medium text-muted-foreground",
        inset && "pl-8",
        className
      )}
      {...props}
    />
  );
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      className={cn(
        "h-px bg-border rounded-full shrink-0 py-0 my-0 pointer-events-none",
        className
      )}
      {...props}
    />
  );
}

function DropdownMenuShortcut({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn("ml-auto text-xs tracking-widest opacity-60", className)}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
};
