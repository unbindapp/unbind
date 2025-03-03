import {
  logViewPreferenceKeys,
  useLogViewPreferences,
} from "@/components/logs/log-view-preferences-provider";
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

export default function LogLine({ logLine, className, classNameInner, ...rest }: Props) {
  const { preferences: viewPreferences } = useLogViewPreferences();

  const hasExtraColumns =
    viewPreferences.includes(logViewPreferenceKeys.timestamp) ||
    viewPreferences.includes(logViewPreferenceKeys.serviceId);
  return (
    <div
      {...rest}
      suppressHydrationWarning
      data-level={logLine.level}
      data-wrap={viewPreferences.includes(logViewPreferenceKeys.lineWrapping) ? true : undefined}
      data-extra-columns={hasExtraColumns ? true : undefined}
      className={cn(
        `group/line flex w-full items-stretch py-px font-mono text-xs data-first:pt-3 data-last:pb-[calc(1rem+var(--safe-area-inset-bottom))] data-[container=page]:data-last:pb-4 data-[container=sheet]:data-last:pb-[calc(1rem+var(--safe-area-inset-bottom))] sm:data-last:pb-[calc(1.5rem+var(--safe-area-inset-bottom))] sm:data-[container=page]:data-last:pb-[calc(1.5rem+var(--safe-area-inset-bottom))] sm:data-[container=sheet]:data-last:pb-[calc(1.5rem+var(--safe-area-inset-bottom))]`,
        className,
      )}
    >
      <div
        className={cn(
          `group-data-[level=warn]/line:bg-warning/10 group-data-[level=error]/line:bg-destructive/10 group-hover/line:bg-border group-data-[level=warn]/line:group-hover/line:bg-warning/20 group-data-[level=error]/line:group-hover/line:bg-destructive/20 flex w-full items-center pl-3 sm:pl-4`,
          classNameInner,
        )}
      >
        <div className="flex shrink-0 self-stretch py-1 pr-1.5">
          <div className="bg-muted-more-foreground/50 group-data-[level=warn]/line:bg-warning group-data-[level=error]/line:bg-destructive w-0.75 self-stretch rounded-full" />
        </div>
        <div className="flex min-w-0 flex-1 [mask-image:linear-gradient(to_left,transparent,black_1rem)]">
          <ConditionalScrollArea>
            <div className="flex flex-col items-start gap-0.5 py-0.5 group-data-wrap/line:w-full lg:flex-row lg:py-0.25">
              {/* Timestamp and service name */}
              {hasExtraColumns && (
                <div className="sticky left-0 z-10 flex items-center justify-start py-1 group-data-wrap/line:relative group-data-wrap/line:left-auto group-data-wrap/line:w-full md:group-data-wrap/line:w-auto">
                  <div className="bg-background flex min-w-0 flex-1 [mask-image:linear-gradient(to_left,transparent,black_1rem)] md:min-w-auto">
                    <div className="bg-background group-hover/line:bg-border group-data-[level=warn]/line:bg-warning/10 group-data-[level=error]/line:bg-destructive/10 group-data-[level=warn]/line:group-hover/line:bg-warning/20 group-data-[level=error]/line:group-hover/line:bg-destructive/20 flex min-w-0 flex-1 items-center justify-start md:min-w-auto">
                      {viewPreferences.includes(logViewPreferenceKeys.timestamp) && (
                        <p
                          suppressHydrationWarning
                          className="text-muted-foreground w-36 min-w-0 shrink overflow-hidden px-1 pr-4 leading-tight text-ellipsis whitespace-nowrap"
                        >
                          {format(logLine.timestamp, "MMM dd, HH:mm:ss")}
                        </p>
                      )}
                      {viewPreferences.includes(logViewPreferenceKeys.serviceId) && (
                        <p
                          suppressHydrationWarning
                          className="text-muted-foreground w-24 min-w-0 shrink overflow-hidden px-1 pr-4 leading-tight text-ellipsis whitespace-nowrap"
                        >
                          {logLine.serviceId}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
              <p className="group-data-[wrap]/line:min-0 px-1 py-1 pr-4 leading-tight whitespace-pre group-data-extra-columns/line:-mt-2 group-data-wrap/line:shrink group-data-wrap/line:whitespace-normal lg:group-data-extra-columns/line:mt-0">
                {logLine.message}
              </p>
            </div>
          </ConditionalScrollArea>
        </div>
      </div>
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
