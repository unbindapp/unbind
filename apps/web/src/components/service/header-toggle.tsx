import { Button } from "@/components/ui/button";
import { ToggleKnob } from "@/components/ui/toggle-knob";
import { cn } from "@/components/ui/utils";

type TProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
};

export default function HeaderToggle({ label, checked, onChange, disabled, className }: TProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "group/button has-hover:hover:bg-border -my-1 -mr-0.75 ml-auto flex cursor-pointer items-center justify-center gap-2.5 self-end rounded-full py-1 pr-1.25 pl-2.5 font-medium",
        className,
      )}
    >
      <p className="text-muted-foreground has-hover:group-hover/button:text-foreground min-w-0 shrink text-sm">
        {label}
      </p>
      <ToggleKnob checked={checked} size="sm" />
    </Button>
  );
}
