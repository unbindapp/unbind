import * as React from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";

import { cn } from "@/components/ui/utils";
import { cva, VariantProps } from "class-variance-authority";

function Popover({ ...props }: PopoverPrimitive.Root.Props) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({ ...props }: PopoverPrimitive.Trigger.Props) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

const popoverContentVariants = cva(
  "shadow-shadow-color/shadow-opacity bg-popover text-popover-foreground max-w-(--available-width) max-h-(--available-height) w-(--anchor-width) origin-(--transform-origin) overflow-hidden rounded-lg border p-4 shadow-lg outline-hidden",
  {
    variants: {
      animate: {
        default:
          "data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
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
  align = "center",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 4,
  collisionPadding = {
    top: 16,
    bottom: 16,
    left: 12,
    right: 12,
  },
  animate,
  ...props
}: PopoverPrimitive.Popup.Props &
  Pick<
    PopoverPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset" | "collisionPadding"
  > &
  TPopoverContentVariants) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        data-ui-popup=""
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className="isolate z-50"
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(popoverContentVariants({ animate, className }))}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}

export { Popover, PopoverTrigger, PopoverContent };
