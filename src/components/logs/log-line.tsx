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
      data-extra-columns={hasExtraColumns ? true : undefined}
      className={cn(
        `w-full flex items-stretch text-xs group/line py-px 
        data-first:pt-3 data-[container=page]:data-last:pb-4 sm:data-[container=page]:data-last:pb-[calc(1.5rem+var(--safe-area-inset-bottom))]
        data-[container=sheet]:data-last:pb-[calc(1rem+var(--safe-area-inset-bottom))] sm:data-[container=sheet]:data-last:pb-[calc(1.5rem+var(--safe-area-inset-bottom))]
        data-last:pb-[calc(1rem+var(--safe-area-inset-bottom))] sm:data-last:pb-[calc(1.5rem+var(--safe-area-inset-bottom))] font-mono`,
        className
      )}
    >
      <div
        className={cn(
          `pl-3 sm:pl-4 w-full flex items-center group-data-[level=warn]/line:bg-warning/10 group-data-[level=error]/line:bg-destructive/10
          group-hover/line:bg-border group-data-[level=warn]/line:group-hover/line:bg-warning/20 group-data-[level=error]/line:group-hover/line:bg-destructive/20`,
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
            <div className="group-data-wrap/line:w-full flex flex-col items-start lg:flex-row gap-0.5 py-0.5 lg:py-0.25">
              {/* Timestamp and service name */}
              {hasExtraColumns && (
                <div
                  className="group-data-wrap/line:w-full md:group-data-wrap/line:w-auto
                  flex items-center justify-start py-1 z-10
                  sticky left-0 group-data-wrap/line:relative group-data-wrap/line:left-auto"
                >
                  <div className="flex-1 min-w-0 md:min-w-auto flex bg-background [mask-image:linear-gradient(to_left,transparent,black_1rem)]">
                    <div
                      className="flex-1 min-w-0 md:min-w-auto flex items-center justify-start bg-background group-hover/line:bg-border
                      group-data-[level=warn]/line:bg-warning/10 group-data-[level=error]/line:bg-destructive/10
                      group-data-[level=warn]/line:group-hover/line:bg-warning/20 group-data-[level=error]/line:group-hover/line:bg-destructive/20"
                    >
                      {viewPreferences.includes(
                        logViewPreferenceKeys.timestamp
                      ) && (
                        <p
                          suppressHydrationWarning
                          className="pr-4 shrink min-w-0 text-muted-foreground px-1 w-36 overflow-hidden text-ellipsis whitespace-nowrap leading-tight"
                        >
                          {format(logLine.timestamp, "MMM dd, HH:mm:ss")}
                        </p>
                      )}
                      {viewPreferences.includes(
                        logViewPreferenceKeys.serviceId
                      ) && (
                        <p
                          suppressHydrationWarning
                          className="pr-4 shrink min-w-0 text-muted-foreground px-1 w-24 overflow-hidden text-ellipsis whitespace-nowrap leading-tight"
                        >
                          {logLine.serviceId}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
              <p
                className="py-1 group-data-extra-columns/line:-mt-2 lg:group-data-extra-columns/line:mt-0 px-1 leading-tight pr-4
                group-data-wrap/line:shrink group-data-[wrap]/line:min-0 whitespace-pre group-data-wrap/line:whitespace-normal"
              >
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
