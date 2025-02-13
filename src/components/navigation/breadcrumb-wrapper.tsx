import SlashIcon from "@/components/icons/slash";
import { cn } from "@/components/ui/utils";
import { ReactNode } from "react";

export function BreadcrumbWrapper({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex items-stretch justify-start", className)}>
      {children}
    </div>
  );
}

export function BreadcrumbSeparator({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "text-foreground/16 w-3 sm:w-4 min-h-5.5 self-stretch flex items-center justify-center shrink-0 overflow-hidden",
        className
      )}
    >
      <SlashIcon className="size-5.5" />
    </div>
  );
}
