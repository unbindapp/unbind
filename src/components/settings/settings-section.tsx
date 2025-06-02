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
  classNameVerticalLine,
}: {
  id: string;
  title: string;
  Icon: FC<{ className?: string }>;
  children: ReactNode;
  className?: string;
  classNameTitleDiv?: string;
  classNameHeader?: string;
  classNameVerticalLine?: string;
}) {
  return (
    <div id={id} className={cn("flex w-full flex-col pt-4 sm:pt-8", className)}>
      <div className="flex w-full gap-3">
        <div
          className={cn(
            "text-muted-foreground mt-0.25 hidden flex-col items-center gap-3 sm:flex",
            classNameHeader,
          )}
        >
          <Icon className="size-5 shrink-0" />
          <div
            className={cn(
              "bg-foreground/10 min-h-0 w-px flex-1 rounded-full",
              classNameVerticalLine,
            )}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2 pb-1">
          <div
            className={cn(
              "text-muted-foreground flex w-full items-center gap-2 px-1.5 pb-1 sm:px-0 sm:pb-0",
              classNameHeader,
            )}
          >
            <Icon className="size-5 shrink-0 sm:hidden" />
            <h3
              className={cn(
                "min-w-0 shrink text-lg leading-tight font-semibold sm:px-1.5",
                classNameTitleDiv,
              )}
            >
              {title}
            </h3>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export function SettingsSectionDivider({ className }: { className?: string }) {
  return (
    <div className={cn("bg-border -mx-3 mt-5 h-px w-[calc(100%+1.5rem)] sm:hidden", className)} />
  );
}
