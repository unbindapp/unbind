import { cn } from "@/components/ui/utils";

type TProps = {
  checked: boolean;
  hasChanges?: boolean;
  className?: string;
};

export function ToggleKnob({ checked, hasChanges, className }: TProps) {
  return (
    <div
      data-checked={checked || undefined}
      data-staged={hasChanges || undefined}
      className={cn(
        "group/knob bg-muted-more-foreground data-checked:bg-foreground data-staged:bg-change/7-10 data-staged:data-checked:bg-change relative h-5 w-9 shrink-0 rounded-full transition",
        className,
      )}
    >
      <div className="bg-background absolute top-0.5 left-0.5 size-4 rounded-full transition group-data-checked/knob:translate-x-4" />
    </div>
  );
}
