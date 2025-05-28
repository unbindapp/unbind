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
    <div className={cn("flex min-w-0 shrink items-stretch justify-start", className)}>
      {children}
    </div>
  );
}

export function BreadcrumbSeparator({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "text-foreground/16 flex min-h-5.5 w-3 shrink-0 items-center justify-center self-stretch overflow-hidden sm:w-4",
        className,
      )}
    >
      <SlashIcon className="size-5.5" />
    </div>
  );
}
