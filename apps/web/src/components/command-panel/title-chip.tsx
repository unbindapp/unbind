import { cn } from "@/components/ui/utils";
import { ReactNode } from "react";

export default function TitleChip({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "bg-foreground/2-10 border-foreground/2-10 rounded-sm border px-1.25 font-mono text-sm font-normal",
        className,
      )}
    >
      {children}
    </span>
  );
}
