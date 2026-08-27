import { Slider as SliderPrimitive } from "@base-ui/react/slider";

import { cn } from "@/components/ui/utils";

export type SliderProps<Value extends number | readonly number[] = number | readonly number[]> =
  SliderPrimitive.Root.Props<Value>;

function Slider<Value extends number | readonly number[]>({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...props
}: SliderProps<Value>) {
  const _values = Array.isArray(value)
    ? value
    : Array.isArray(defaultValue)
      ? defaultValue
      : [min, max];

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      thumbAlignment="edge"
      className={cn("data-horizontal:w-full data-vertical:h-full", className)}
      {...props}
    >
      <SliderPrimitive.Control className="group/slider relative flex w-full touch-none items-center select-none before:absolute before:top-1/2 before:left-1/2 before:h-full before:min-h-11 before:w-full before:min-w-11 before:-translate-1/2 active:cursor-grabbing has-hover:hover:cursor-grab has-hover:hover:active:cursor-grabbing data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-44 data-vertical:w-auto data-vertical:flex-col">
        <SliderPrimitive.Track
          data-slot="slider-track"
          className="bg-border relative grow overflow-hidden rounded-full select-none data-horizontal:h-1.5 data-horizontal:w-full data-vertical:h-full data-vertical:w-1.5"
        >
          <SliderPrimitive.Indicator
            data-slot="slider-range"
            className="bg-primary select-none data-horizontal:h-full data-vertical:w-full"
          />
        </SliderPrimitive.Track>
        {Array.from({ length: _values.length }, (_, index) => (
          <SliderPrimitive.Thumb
            data-slot="slider-thumb"
            key={index}
            className="bg-foreground shadow-shadow-color/shadow-opacity group-active/slider:ring-foreground/50 active:ring-foreground/50 ring-foreground/25 block size-4 shrink-0 rounded-full shadow-md transition-[color,box-shadow] select-none group-active/slider:ring-4 focus-visible:ring-6 focus-visible:outline-hidden active:cursor-grabbing active:ring-4 disabled:pointer-events-none disabled:opacity-50 has-hover:group-hover/slider:ring-6 has-hover:group-hover/slider:group-active/slider:ring-4"
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}

export { Slider };
