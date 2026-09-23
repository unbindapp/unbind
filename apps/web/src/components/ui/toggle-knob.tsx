import { cn } from "@/components/ui/utils";

type TProps = {
  checked: boolean;
  hasChanges?: boolean;
  className?: string;
  size?: "sm" | "md";
};

export function ToggleKnob({ checked, hasChanges, size = "md", className }: TProps) {
  return (
    <div
      data-checked={checked || undefined}
      data-staged={hasChanges || undefined}
      data-size={size}
      className={cn(
        // The color is animated through currentColor: Chrome runs background-color transitions
        // on the compositor and can paint the start color for a frame when they end
        "group/knob text-muted-more-foreground data-checked:text-foreground data-staged:text-change/7-10 data-staged:data-checked:text-change relative h-5 w-9 shrink-0 rounded-full bg-current transition data-[size=sm]:h-4.5 data-[size=sm]:w-8",
        className,
      )}
    >
      <div className="bg-background absolute top-0.5 left-0.5 size-4 rounded-full transition group-data-checked/knob:translate-x-4 group-data-[size=sm]/knob:size-3.5 group-data-checked/knob:group-data-[size=sm]/knob:translate-x-3.5" />
    </div>
  );
}
