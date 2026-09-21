import { cn } from "@/components/ui/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { LoaderIcon } from "lucide-react";
import type { FC, ReactNode } from "react";

const chipVariants = cva(
  "flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        change: "text-change bg-change/5-10 border-change/5-10",
        process: "text-process bg-process/5-10 border-process/5-10",
        success: "text-success bg-success/5-10 border-success/5-10",
        warning: "text-warning bg-warning/5-10 border-warning/5-10",
      },
    },
    defaultVariants: {
      variant: "change",
    },
  },
);

type TProps = VariantProps<typeof chipVariants> & {
  Icon?: FC<{ className?: string }>;
  isLoading?: boolean;
  className?: string;
  classNameInner?: string;
  classNameIcon?: string;
  children: ReactNode;
};

export function Chip({
  variant,
  Icon,
  isLoading,
  className,
  classNameInner,
  classNameIcon,
  children,
}: TProps) {
  const VisibleIcon = isLoading ? LoaderIcon : Icon;
  return (
    <div className={cn("bg-background shrink-0 rounded-sm", className)}>
      <p className={cn(chipVariants({ variant }), classNameInner)}>
        {VisibleIcon && (
          <VisibleIcon
            className={cn("-ml-px size-3 shrink-0", isLoading && "animate-spin", classNameIcon)}
          />
        )}
        <span className="truncate">{children}</span>
      </p>
    </div>
  );
}
