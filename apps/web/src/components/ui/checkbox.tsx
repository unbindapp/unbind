import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { CheckIcon } from "lucide-react";

import { cn } from "@/components/ui/utils";

function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer bg-border ring-foreground/20 focus-visible:ring-foreground/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 focus-visible:ring-offset-background size-3.75 shrink-0 rounded-sm ring-1 outline-none focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="data-checked:ring-foreground data-checked:bg-primary data-checked:text-primary-foreground flex size-full items-center justify-center rounded-sm p-0.25 text-current ring-1 ring-transparent transition-none"
      >
        <CheckIcon className="size-full" strokeWidth={4} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
