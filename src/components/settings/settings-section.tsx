import { cn } from "@/components/ui/utils";
import { FC, ReactNode } from "react";

export function SettingsSection({
  id,
  title,
  Icon,
  children,
  className,
  classNameTitleDiv,
  classNameHeader,
}: {
  id: string;
  title: string;
  Icon: FC<{ className?: string }>;
  children: ReactNode;
  className?: string;
  classNameTitleDiv?: string;
  classNameHeader?: string;
}) {
  return (
    <div
      id={id}
      className={cn(
        "relative z-0 flex w-full flex-col overflow-hidden rounded-xl border md:max-w-xl",
        className,
      )}
    >
      <div
        className={cn(
          "text-muted-foreground bg-background-hover flex w-full items-center gap-2.5 border-b px-3.5 py-2.5 sm:px-4 sm:py-3",
          classNameHeader,
        )}
      >
        <Icon className="size-5 shrink-0" />
        <h3 className={cn("min-w-0 shrink text-lg leading-tight font-medium", classNameTitleDiv)}>
          {title}
        </h3>
      </div>
      <div className="flex w-full flex-col px-3 pt-3 pb-3.25 sm:px-4.5 sm:pt-3.75 sm:pb-4.75">
        {children}
      </div>
    </div>
  );
}

export function SettingsSectionDivider({ className }: { className?: string }) {
  return (
    <div className={cn("bg-border -mx-3 mt-5 h-px w-[calc(100%+1.5rem)] sm:hidden", className)} />
  );
}
