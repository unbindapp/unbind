"use client";

import * as React from "react";
import { type DialogProps } from "@radix-ui/react-dialog";
import { Command as CommandPrimitive } from "cmdk";
import { cn } from "@/components/ui/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cva, VariantProps } from "class-variance-authority";
import { LoaderIcon, SearchIcon } from "lucide-react";

const commandVariants = cva(
  "flex h-full w-full flex-col overflow-hidden rounded-lg focus:outline-hidden",
  {
    variants: {
      variant: {
        default: "bg-popover text-popover-foreground",
        modal: "bg-background text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Command({
  className,
  variant,
  ...props
}: React.ComponentProps<typeof CommandPrimitive> &
  VariantProps<typeof commandVariants>) {
  return (
    <CommandPrimitive
      className={cn(
        commandVariants({
          variant,
          className,
        })
      )}
      {...props}
    />
  );
}

type CommandDialogProps = DialogProps & {};

function CommandDialog({ children, ...props }: CommandDialogProps) {
  return (
    <Dialog {...props}>
      <DialogContent className="overflow-hidden p-0">
        <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3">
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  );
}

function CommandInput({
  className,
  classNameWrapper,
  showSpinner = false,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Input> & {
  classNameWrapper?: string;
  showSpinner?: boolean;
}) {
  return (
    <div
      className={cn("flex items-center border-b relative", classNameWrapper)}
      cmdk-input-wrapper=""
    >
      <div
        data-show-spinner={showSpinner ? true : undefined}
        className="size-4 left-3.5 pointer-events-none absolute shrink-0 text-muted-foreground group"
      >
        {!showSpinner && (
          <SearchIcon className="size-full text-muted-foreground" />
        )}
        {showSpinner && (
          <LoaderIcon className="absolute size-full animate-spin" />
        )}
      </div>
      <CommandPrimitive.Input
        className={cn(
          "flex w-full pl-9.5 pr-4 py-3 leading-none rounded-md bg-transparent outline-hidden placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    </div>
  );
}

function CommandList({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.List>) {
  return <CommandPrimitive.List className={cn("p-1", className)} {...props} />;
}

function CommandEmpty(
  props: React.ComponentProps<typeof CommandPrimitive.Empty>
) {
  return (
    <CommandPrimitive.Empty
      className="px-4 py-6 text-center text-muted-foreground"
      {...props}
    />
  );
}

function CommandGroup({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      className={cn(
        "overflow-hidden group/command text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground",
        className
      )}
      {...props}
    />
  );
}

function CommandSeparator({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      className={cn("-mx-1 h-px bg-border", className)}
      {...props}
    />
  );
}

const commandItemVariants = cva(
  "relative flex cursor-default gap-2 select-none items-center rounded-lg px-2 py-1.5 outline-hidden data-[disabled=true]:pointer-events-none data-[selected=true]:bg-border data-[selected=true]:text-foreground data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "",
      },
      state: {
        default: "",
        pending: "opacity-100 data-[disabled=true]:opacity-100",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function CommandItem({
  className,
  state,
  disabled,
  variant,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item> &
  VariantProps<typeof commandItemVariants>) {
  return (
    <CommandPrimitive.Item
      className={cn(commandItemVariants({ state, variant }), className)}
      disabled={state === "pending" ? true : disabled}
      {...props}
    />
  );
}

function CommandShortcut({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "ml-auto text-xs tracking-widest text-muted-foreground",
        className
      )}
      {...props}
    />
  );
}

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
};
