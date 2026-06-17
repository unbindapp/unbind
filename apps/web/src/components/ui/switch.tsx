"use client";

import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/components/ui/utils";

function Switch({
  className,
  classNameThumb,
  ...props
}: React.ComponentProps<typeof SwitchPrimitives.Root> & {
  classNameThumb?: string;
}) {
  return (
    <SwitchPrimitives.Root
      className={cn(
        "peer focus-visible:ring-primary/50 focus-visible:ring-offset-background data-[state=checked]:bg-foreground data-[state=unchecked]:bg-muted-more-foreground relative inline-flex h-6 w-11 shrink-0 cursor-pointer touch-manipulation items-center rounded-full border-2 border-transparent transition-colors focus-visible:ring-1 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50",
        "z-0 before:absolute before:z-[-1] before:h-full before:min-h-[48px] before:w-full before:min-w-[48px] before:bg-transparent",
        className,
      )}
      {...props}
    >
      <SwitchPrimitives.Thumb
        className={cn(
          "bg-background pointer-events-none block size-5 rounded-full ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0",
          classNameThumb,
        )}
      />
    </SwitchPrimitives.Root>
  );
}

export { Switch };
