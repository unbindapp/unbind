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
      wrapper: {
        default:
          "rounded-xl h-108 max-h-[min(calc(100vh-(100vh-3rem)*0.1-7rem),50vh)] sm:max-h-[calc(100vh-(100vh-3rem)*0.1-7rem)] border shadow-xl shadow-shadow/shadow",
        none: "",
      },
    },
    defaultVariants: {
      variant: "default",
      wrapper: "default",
    },
  },
);

export type TCommandVariants = VariantProps<typeof commandVariants>;

function Command({
  className,
  variant,
  wrapper,
  ...props
}: React.ComponentProps<typeof CommandPrimitive> & TCommandVariants) {
  return (
    <CommandPrimitive
      className={cn(
        commandVariants({
          variant,
          wrapper,
          className,
        }),
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
        <Command className="[&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]]:px-2 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3">
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
      className={cn("relative flex items-center border-b", classNameWrapper)}
      cmdk-input-wrapper=""
    >
      <div
        data-show-spinner={showSpinner ? true : undefined}
        className="text-muted-foreground group pointer-events-none absolute left-3.5 size-4 shrink-0"
      >
        {!showSpinner && <SearchIcon className="text-muted-foreground size-full" />}
        {showSpinner && <LoaderIcon className="absolute size-full animate-spin" />}
      </div>
      <CommandPrimitive.Input
        className={cn(
          "placeholder:text-muted-foreground flex w-full rounded-md bg-transparent py-3 pr-4 pl-9.5 leading-none outline-hidden disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    </div>
  );
}

function CommandList({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.List>) {
  return <CommandPrimitive.List className={cn("p-1", className)} {...props} />;
}

function CommandEmpty(props: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty className="text-muted-foreground px-4 py-6 text-center" {...props} />
  );
}

function CommandGroup({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      className={cn(
        "group/command text-foreground [&_[cmdk-group-heading]]:text-muted-foreground overflow-hidden [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium",
        className,
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
    <CommandPrimitive.Separator className={cn("bg-border -mx-1 h-px", className)} {...props} />
  );
}

const commandItemVariants = cva(
  "relative flex cursor-default gap-2 select-none items-center rounded-lg px-2.5 py-2.5 outline-hidden data-[disabled=true]:pointer-events-none data-[selected=true]:bg-border data-[disabled=true]:data-[selected=true]:bg-transparent data-[selected=true]:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "",
      },
      state: {
        default: "",
        pending: "opacity-100 data-[disabled=true]:opacity-100",
      },
      fadeOnDisabled: {
        default: "disabled:opacity-50",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function CommandItem({
  className,
  state,
  disabled,
  variant,
  fadeOnDisabled,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item> & VariantProps<typeof commandItemVariants>) {
  return (
    <CommandPrimitive.Item
      className={cn(commandItemVariants({ state, variant, fadeOnDisabled }), className)}
      disabled={state === "pending" ? true : disabled}
      {...props}
    />
  );
}

function CommandShortcut({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn("text-muted-foreground ml-auto text-xs tracking-widest", className)}
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
