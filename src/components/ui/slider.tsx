"use client";

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/components/ui/utils";

export type SliderProps = React.ComponentProps<typeof SliderPrimitive.Root>;

function Slider({ className, defaultValue, value, min = 0, max = 100, ...props }: SliderProps) {
  const _values = React.useMemo(
    () => (Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min, max]),
    [value, defaultValue, min, max],
  );

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        "group/slider relative flex w-full touch-none items-center select-none before:absolute before:top-1/2 before:left-1/2 before:h-full before:min-h-[44px] before:w-full before:min-w-[44px] before:-translate-1/2 active:cursor-grabbing has-hover:hover:cursor-grab has-hover:hover:active:cursor-grabbing data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className={cn(
          "bg-border relative grow overflow-hidden rounded-full data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5",
        )}
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className={cn(
            "bg-primary absolute data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full",
          )}
        />
      </SliderPrimitive.Track>
      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          className="bg-foreground shadow-shadow/shadow group-active/slider:ring-foreground/50 active:ring-foreground/50 ring-foreground/25 block size-4 shrink-0 rounded-full shadow-md transition-[color,box-shadow] group-active/slider:ring-4 focus-visible:ring-6 focus-visible:outline-hidden active:cursor-grabbing active:ring-4 disabled:pointer-events-none disabled:opacity-50 has-hover:group-hover/slider:ring-6 has-hover:group-hover/slider:group-active/slider:ring-4"
        />
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider };
