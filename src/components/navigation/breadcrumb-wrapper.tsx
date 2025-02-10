import { cn } from "@/components/ui/utils";
import { SlashIcon } from "lucide-react";
import { ReactNode } from "react";

export function BreadcrumbWrapper({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex items-center justify-start", className)}>
      {children}
    </div>
  );
}

export function BreadcrumbSeparator({ className }: { className?: string }) {
  return (
    <SlashIcon
      className={cn(
        "text-foreground/16 -mx-0.5 sm:mx-0 -rotate-30 size-4 shrink-0",
        className
      )}
      strokeWidth={3}
    />
  );
}
