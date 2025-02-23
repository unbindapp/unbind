import {
  logViewPreferenceKeys,
  useLogViewPreferences,
} from "@/components/logs/log-view-preference-provider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/utils";
import { format } from "date-fns";
import { ComponentProps, ReactNode } from "react";

export type TLogLine = {
  level: "info" | "warn" | "error";
  timestamp: number;
  message: string;
  deploymentId: string;
  serviceId: string;
};

type Props = {
  logLine: TLogLine;
  classNameInner?: string;
} & ComponentProps<"div">;

export default function LogLine({
  logLine,
  className,
  classNameInner,
  ...rest
}: Props) {
  const { preferences: viewPreferences } = useLogViewPreferences();

  const hasExtraColumns =
    viewPreferences.includes(logViewPreferenceKeys.timestamp) ||
    viewPreferences.includes(logViewPreferenceKeys.serviceId);
  return (
    <div
      {...rest}
      suppressHydrationWarning
      data-level={logLine.level}
      data-wrap={
        viewPreferences.includes(logViewPreferenceKeys.lineWrapping)
          ? true
          : undefined
      }
      className={cn(
        `w-full flex items-stretch text-xs group/line py-px 
        data-[first]:pt-3
        data-[last]:pb-[calc(1rem+var(--safe-area-inset-bottom))] sm:data-[last]:pb-[calc(1.5rem+var(--safe-area-inset-bottom))] font-mono`,
        className
      )}
    >
      <div
        className={cn(
          `pl-3 sm:pl-4 w-full flex items-center group-data-[level=warn]/line:bg-warning-highlight group-data-[level=error]/line:bg-destructive-highlight
          group-hover/line:bg-border group-hover/line:group-data-[level=warn]/line:bg-warning-highlight-hover group-hover/line:group-data-[level=error]/line:bg-destructive-highlight-hover`,
          classNameInner
        )}
      >
        <div className="self-stretch flex pr-1.5 shrink-0 py-1">
          <div
            className="self-stretch w-0.75 rounded-full bg-muted-more-foreground/50 group-data-[level=warn]/line:bg-warning 
            group-data-[level=error]/line:bg-destructive"
          />
        </div>
        <div className="flex-1 min-w-0 flex [mask-image:linear-gradient(to_left,transparent,black_1rem)]">
          <ConditionalScrollArea>
            <div className="group-data-[wrap]/line:w-full flex flex-col items-start md:flex-row gap-0.5 py-0.5 md:py-0.25">
              {/* Timestamp and service name */}
              {hasExtraColumns && (
                <div
                  className="group-data-[wrap]/line:w-full md:group-data-[wrap]/line:w-auto
                  flex items-center justify-start py-1 z-10
                  sticky left-0 group-data-[wrap]/line:relative group-data-[wrap]/line:left-auto"
                >
                  <div
                    className="flex-1 min-w-0 md:min-w-auto flex items-center justify-start bg-background group-hover/line:bg-border
                    group-data-[level=warn]/line:bg-warning-highlight group-data-[level=error]/line:bg-destructive-highlight
                    group-hover/line:group-data-[level=warn]/line:bg-warning-highlight-hover group-hover/line:group-data-[level=error]/line:bg-destructive-highlight-hover
                    [mask-image:linear-gradient(to_left,transparent,black_1rem)]"
                  >
                    {viewPreferences.includes(
                      logViewPreferenceKeys.timestamp
                    ) && (
                      <p
                        suppressHydrationWarning
                        className="pr-4 shrink min-w-0 text-muted-foreground px-1 w-36 overflow-hidden overflow-ellipsis whitespace-nowrap leading-tight"
                      >
                        {format(logLine.timestamp, "MMM dd, HH:mm:ss")}
                      </p>
                    )}
                    {viewPreferences.includes(
                      logViewPreferenceKeys.serviceId
                    ) && (
                      <p
                        suppressHydrationWarning
                        className="pr-4 shrink min-w-0 text-muted-foreground px-1 w-24 overflow-hidden overflow-ellipsis whitespace-nowrap leading-tight"
                      >
                        {logLine.serviceId}
                      </p>
                    )}
                  </div>
                </div>
              )}
              <ConditionallyWrappedLine
                data-extra-columns={hasExtraColumns ? true : undefined}
                className="py-1 data-[extra-columns]:-mt-2 sm:data-[extra-columns]:mt-0 px-1 leading-tight pr-4"
              >
                {logLine.message}
              </ConditionallyWrappedLine>
            </div>
          </ConditionalScrollArea>
        </div>
      </div>
    </div>
  );
}

function ConditionallyWrappedLine({
  children,
  className,
  ...rest
}: {
  children: string;
  className?: string;
} & ComponentProps<"div">) {
  const { preferences } = useLogViewPreferences();

  if (preferences.includes(logViewPreferenceKeys.lineWrapping)) {
    return (
      <p
        {...rest}
        suppressHydrationWarning
        className={cn("shrink min-w-0", className)}
      >
        {children}
      </p>
    );
  }
  return (
    <div {...rest} className={cn("flex", className)}>
      <pre suppressHydrationWarning>{children}</pre>
    </div>
  );
}

function ConditionalScrollArea({ children }: { children: ReactNode }) {
  const { preferences } = useLogViewPreferences();

  if (preferences.includes(logViewPreferenceKeys.lineWrapping)) {
    return children;
  }

  return <ScrollArea orientation="horizontal">{children}</ScrollArea>;
}
