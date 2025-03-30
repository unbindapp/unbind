import {
  logViewPreferenceKeys,
  useLogViewPreferences,
} from "@/components/logs/log-view-preferences-provider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/utils";
import { TLogLine } from "@/lib/hooks/use-logs";
import { format } from "date-fns";
import { ComponentProps, ReactNode } from "react";

type TProps = ComponentProps<"div"> & {
  classNameInner?: string;
} & ({ logLine: TLogLine; isPlaceholder?: never } | { logLine?: never; isPlaceholder: true });

export default function LogLine({
  logLine,
  isPlaceholder,
  className,
  classNameInner,
  ...rest
}: TProps) {
  const { preferences: viewPreferences } = useLogViewPreferences();

  const hasExtraColumns =
    viewPreferences.includes(logViewPreferenceKeys.timestamp) ||
    viewPreferences.includes(logViewPreferenceKeys.serviceId);
  return (
    <div
      {...rest}
      suppressHydrationWarning
      data-level={"info"}
      data-wrap={viewPreferences.includes(logViewPreferenceKeys.lineWrapping) ? true : undefined}
      data-extra-columns={hasExtraColumns ? true : undefined}
      className={cn(
        `group/line flex w-full items-stretch py-px font-mono text-xs data-first:pt-3 data-last:pb-[calc(1rem+var(--safe-area-inset-bottom))] data-[container=page]:data-last:pb-4 data-[container=sheet]:data-last:pb-[calc(1rem+var(--safe-area-inset-bottom))] sm:data-last:pb-[calc(1.5rem+var(--safe-area-inset-bottom))] sm:data-[container=page]:data-last:pb-[calc(1.5rem+var(--safe-area-inset-bottom))] sm:data-[container=sheet]:data-last:pb-[calc(1.5rem+var(--safe-area-inset-bottom))]`,
        className,
      )}
      data-placeholder={isPlaceholder ? true : undefined}
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
                        <div className="w-36 min-w-0 shrink overflow-hidden pr-4 pl-1">
                          <p
                            suppressHydrationWarning
                            className="group-data-placeholder/line:bg-muted-foreground group-data-placeholder/line:animate-skeleton text-muted-foreground truncate leading-tight text-ellipsis whitespace-nowrap group-data-placeholder/line:rounded group-data-placeholder/line:text-transparent"
                          >
                            {isPlaceholder
                              ? "Jan 01, 01:01:01"
                              : format(logLine.timestamp, "MMM dd, HH:mm:ss")}
                          </p>
                        </div>
                      )}
                      {viewPreferences.includes(logViewPreferenceKeys.serviceId) && (
                        <div className="w-24 min-w-0 shrink overflow-hidden pr-4 pl-1">
                          <p
                            suppressHydrationWarning
                            className="group-data-placeholder/line:bg-muted-foreground group-data-placeholder/line:animate-skeleton text-muted-foreground truncate leading-tight text-ellipsis whitespace-nowrap group-data-placeholder/line:rounded group-data-placeholder/line:text-transparent"
                          >
                            {isPlaceholder ? "Unbind" : logLine.pod_name}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              <div className="flex max-w-full py-1 pr-4 pl-1 group-data-wrap/line:max-w-auto group-data-wrap/line:min-w-0 group-data-wrap/line:shrink">
                <p className="group-data-placeholder/line:bg-foreground group-data-placeholder/line:animate-skeleton leading-tight whitespace-pre group-data-extra-columns/line:-mt-2 group-data-placeholder/line:rounded group-data-placeholder/line:text-transparent group-data-wrap/line:min-w-0 group-data-wrap/line:shrink group-data-wrap/line:whitespace-normal lg:group-data-extra-columns/line:mt-0">
                  {isPlaceholder ? "Loading the messages..." : logLine.message}
                </p>
              </div>
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
