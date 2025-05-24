import { cn } from "@/components/ui/utils";
import { FC, ReactNode } from "react";

export function SettingsSection({
  id,
  title,
  Icon,
  children,
  className,
}: {
  id: string;
  title: string;
  Icon: FC<{ className?: string }>;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div id={id} className={cn("flex w-full flex-col", className)}>
      <div className="flex w-full items-center justify-start gap-2 px-1 pb-3">
        <Icon className="size-4.5 shrink-0" />
        <h3 className="min-w-0 shrink text-lg leading-tight font-semibold">{title}</h3>
        <div className="h-px flex-1" />
      </div>
      {children}
    </div>
  );
}
