import { cn } from "@/components/ui/utils";
import { FC, ReactNode } from "react";

export function SettingsSection({
  id,
  title,
  Icon,
  children,
  className,
  classNameTitleDiv,
}: {
  id: string;
  title: string;
  Icon: FC<{ className?: string }>;
  children: ReactNode;
  className?: string;
  classNameTitleDiv?: string;
}) {
  return (
    <div id={id} className={cn("flex w-full flex-col", className)}>
      <div
        className={cn("flex w-full items-center justify-start gap-2 px-1 pb-3", classNameTitleDiv)}
      >
        <Icon className="size-5 shrink-0" />
        <h3 className="min-w-0 shrink text-lg leading-tight font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}
