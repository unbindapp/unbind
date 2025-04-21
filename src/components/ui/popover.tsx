"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { cn } from "@/components/ui/utils";
import { cva, VariantProps } from "class-variance-authority";

function Popover({ modal = true, ...rest }: PopoverPrimitive.PopoverProps) {
  return <PopoverPrimitive.Root modal={modal} {...rest} />;
}

const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverAnchor = PopoverPrimitive.Anchor;

export const popoverContentVariants = cva(
  "shadow-shadow/shadow bg-popover text-popover-foreground z-50 w-(--radix-popover-trigger-width) rounded-lg border p-4 shadow-lg outline-hidden",
  {
    variants: {
      animate: {
        default:
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        false: "",
      },
    },
    defaultVariants: {
      animate: "default",
    },
  },
);

type TPopoverContentVariants = VariantProps<typeof popoverContentVariants>;

function PopoverContent({
  className,
  collisionPadding = 16,
  align = "center",
  sideOffset = 4,
  animate,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content> & TPopoverContentVariants) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(popoverContentVariants({ animate, className }))}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor };
