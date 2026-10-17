import { cn } from "@/components/ui/utils";
import { ReactNode } from "react";

type TProps = {
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  classNameContent?: string;
};

export default function SettingsCard({ children, footer, className, classNameContent }: TProps) {
  return (
    <div
      className={cn(
        "relative z-0 flex w-full flex-col overflow-hidden rounded-xl border",
        className,
      )}
    >
      <div
        className={cn(
          "flex w-full flex-col gap-4 px-3 pt-3 pb-3.25 sm:px-4.5 sm:pt-3.75 sm:pb-4.75",
          classNameContent,
        )}
      >
        {children}
      </div>
      {footer && (
        <div className="bg-card flex w-full flex-col gap-2 border-t p-2 md:p-2.5">{footer}</div>
      )}
    </div>
  );
}

export function SettingsCardFooterRow({ hint, children }: { hint?: string; children?: ReactNode }) {
  return (
    <div className="flex min-h-9 w-full items-center justify-end gap-3">
      {hint && (
        <p className="text-muted-foreground min-w-0 flex-1 px-1.5 text-sm leading-tight text-balance">
          {hint}
        </p>
      )}
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  );
}
