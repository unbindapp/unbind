import CopyButton from "@/components/copy-button";
import { logTypeCapabilities, useLogFilters } from "@/components/logs/log-filters-provider";
import {
  logViewPreferenceKeys,
  useLogViewPreferences,
} from "@/components/logs/log-view-preferences-provider";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/utils";
import { formatLogMessage } from "@/lib/helpers/format-log-message";
import { parseStructuredLog } from "@/lib/helpers/parse-structured-log";
import { TLogLine, TLogType } from "@/lib/queries/logs";
import { format } from "date-fns";
import { ComponentProps, ReactNode, useEffect, useMemo, useRef } from "react";

type TProps = ComponentProps<"div"> & {
  classNameInner?: string;
  type: TLogType;
} & (
    | {
        logLine: TLogLine;
        serviceName: string;
        isExpanded: boolean;
        onToggleExpanded: () => void;
        isPlaceholder?: never;
      }
    | {
        logLine?: never;
        serviceName?: never;
        isExpanded?: never;
        onToggleExpanded?: never;
        isPlaceholder: true;
      }
  );

export default function LogLine({
  logLine,
  serviceName,
  type,
  isPlaceholder,
  isExpanded,
  onToggleExpanded,
  className,
  classNameInner,
  ...rest
}: TProps) {
  const { preferences: viewPreferences } = useLogViewPreferences();

  const message = logLine?.message;
  const structured = useMemo(
    () => (message === undefined ? null : parseStructuredLog(message)),
    [message],
  );
  const messageSegments = useMemo(() => {
    if (message === undefined) return null;
    return formatLogMessage(structured ? structured.message || message : message).segments;
  }, [message, structured]);

  const hasExtraColumns =
    viewPreferences.includes(logViewPreferenceKeys.timestamp) ||
    viewPreferences.includes(logViewPreferenceKeys.serviceId);

  return (
    <div
      {...rest}
      suppressHydrationWarning
      data-level={logLine?.level || "info"}
      data-wrap={viewPreferences.includes(logViewPreferenceKeys.lineWrapping) || undefined}
      data-extra-columns={hasExtraColumns || undefined}
      data-expanded={isExpanded || undefined}
      className={cn(
        `group/line flex w-full flex-col items-stretch py-px font-mono text-xs data-first:pt-3 data-last:pb-[calc(1rem+var(--safe-area-inset-bottom))] data-[container=page]:data-last:pb-4 sm:data-last:pb-[calc(1.5rem+var(--safe-area-inset-bottom))] sm:data-[container=page]:data-last:pb-6`,
        className,
      )}
      data-placeholder={isPlaceholder || undefined}
      data-real={!isPlaceholder || undefined}
    >
      <div
        role={isPlaceholder ? undefined : "button"}
        tabIndex={isPlaceholder ? undefined : 0}
        onClick={
          isPlaceholder
            ? undefined
            : () => {
                // don't collapse/expand when the user is selecting text
                if (window.getSelection()?.toString()) return;
                onToggleExpanded();
              }
        }
        onKeyDown={
          isPlaceholder
            ? undefined
            : (e) => {
                if (e.key !== "Enter" && e.key !== " ") return;
                if (e.target !== e.currentTarget) return;
                e.preventDefault();
                onToggleExpanded();
              }
        }
        className={cn(
          `group-data-[level=warning]/line:bg-warning/10 group-data-[level=error]/line:bg-destructive/10 group-data-real/line:group-hover/line:bg-border group-data-[level=warning]/line:group-data-real/line:group-hover/line:bg-warning/20 group-data-[level=error]/line:group-data-real/line:group-hover/line:bg-destructive/20 group-data-expanded/line:bg-border group-data-[level=warning]/line:group-data-expanded/line:bg-warning/20 group-data-[level=error]/line:group-data-expanded/line:bg-destructive/20 flex w-full cursor-default items-center pl-3 group-data-real/line:cursor-pointer sm:pl-4`,
          classNameInner,
        )}
      >
        <div className="flex shrink-0 self-stretch py-1 pr-1.5">
          <div className="bg-muted-more-foreground/50 group-data-[level=warning]/line:bg-warning group-data-[level=error]/line:bg-destructive group-data-[level=debug]/line:bg-muted-more-foreground/30 w-0.75 self-stretch rounded-full" />
        </div>
        <div className="flex min-w-0 flex-1 mask-[linear-gradient(to_left,transparent,black_1rem)]">
          <ConditionalScrollArea>
            <div className="flex flex-col items-start gap-0.5 py-0.5 group-data-wrap/line:w-full lg:flex-row lg:py-px">
              {/* Timestamp and service name */}
              {hasExtraColumns && (
                <div className="sticky left-0 z-10 flex items-center justify-start py-1 group-data-wrap/line:relative group-data-wrap/line:left-auto group-data-wrap/line:w-full md:group-data-wrap/line:w-auto">
                  <div className="bg-background flex min-w-0 flex-1 mask-[linear-gradient(to_left,transparent,black_1rem)] md:min-w-auto">
                    <div className="bg-background group-data-real/line:group-hover/line:bg-border group-data-expanded/line:bg-border group-data-[level=warning]/line:bg-warning/10 group-data-[level=error]/line:bg-destructive/10 group-data-[level=warning]/line:group-data-real/line:group-hover/line:bg-warning/20 group-data-[level=error]/line:group-data-real/line:group-hover/line:bg-destructive/20 group-data-[level=warning]/line:group-data-expanded/line:bg-warning/20 group-data-[level=error]/line:group-data-expanded/line:bg-destructive/20 flex min-w-0 flex-1 items-center justify-start md:min-w-auto">
                      {viewPreferences.includes(logViewPreferenceKeys.timestamp) && (
                        <div className="w-36 min-w-0 shrink overflow-hidden pr-4 pl-1">
                          <p
                            suppressHydrationWarning
                            className="group-data-placeholder/line:bg-muted-foreground group-data-placeholder/line:animate-skeleton text-muted-foreground truncate leading-tight text-ellipsis whitespace-nowrap group-data-placeholder/line:rounded group-data-placeholder/line:text-transparent"
                          >
                            {isPlaceholder
                              ? "Jan 01, 01:01:01"
                              : logLine.timestamp === undefined
                                ? "Time Unknown"
                                : format(logLine.timestamp, "MMM dd, HH:mm:ss")}
                          </p>
                        </div>
                      )}
                      {logTypeCapabilities[type].serviceColumn &&
                        viewPreferences.includes(logViewPreferenceKeys.serviceId) && (
                          <div className="w-28 min-w-0 shrink overflow-hidden pr-4 pl-1">
                            <p
                              suppressHydrationWarning
                              className="group-data-placeholder/line:bg-muted-foreground group-data-placeholder/line:animate-skeleton text-muted-foreground truncate leading-tight text-ellipsis whitespace-nowrap group-data-placeholder/line:rounded group-data-placeholder/line:text-transparent"
                            >
                              {isPlaceholder ? "Unbind" : serviceName}
                            </p>
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              )}
              {/* Message itself */}
              <div className="group-data-wrap/line:max-w-auto flex max-w-full py-1 pr-4 pl-1 group-data-wrap/line:min-w-0 group-data-wrap/line:shrink sm:pr-18 data-[container=page]:min-[87rem]:pr-4">
                <p className="group-data-placeholder/line:bg-foreground group-data-placeholder/line:animate-skeleton group-data-[level=debug]/line:text-muted-foreground leading-tight whitespace-pre select-text group-data-extra-columns/line:-mt-2 group-data-placeholder/line:rounded group-data-placeholder/line:text-transparent group-data-wrap/line:min-w-0 group-data-wrap/line:shrink group-data-wrap/line:whitespace-pre-wrap lg:group-data-extra-columns/line:mt-0">
                  {isPlaceholder || !messageSegments
                    ? "Loading the messages..."
                    : messageSegments.map((segment, index) =>
                        segment.style ? (
                          <span key={index} style={segment.style}>
                            {segment.text}
                          </span>
                        ) : (
                          segment.text
                        ),
                      )}
                  {structured &&
                    structured.attributes.map(([key, value]) => (
                      <span key={key} className="text-muted-foreground">
                        {"  "}
                        <span className="opacity-75">{key}=</span>
                        {value}
                      </span>
                    ))}
                </p>
              </div>
            </div>
          </ConditionalScrollArea>
        </div>
      </div>
      {!isPlaceholder && isExpanded && (
        <LogLineDetails
          logLine={logLine}
          serviceName={serviceName}
          structured={structured}
          type={type}
        />
      )}
    </div>
  );
}

function LogLineDetails({
  logLine,
  serviceName,
  structured,
  type,
}: {
  logLine: TLogLine;
  serviceName: string;
  structured: ReturnType<typeof parseStructuredLog>;
  type: TLogType;
}) {
  const { hasActiveFilters, viewInContext, rangeEnabled } = useLogFilters();

  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    rootRef.current?.scrollIntoView({ block: "nearest" });
  }, []);

  const fields: [string, string][] = [
    [
      "Time",
      logLine.timestamp ? format(logLine.timestamp, "MMM dd, yyyy HH:mm:ss.SSS") : "Unknown",
    ],
    ["Level", logLine.level],
    ...(logTypeCapabilities[type].serviceColumn
      ? ([["Service", serviceName]] as [string, string][])
      : []),
    ["Pod", logLine.pod_name || "Unknown"],
    ...(structured ? structured.attributes : []),
  ];

  return (
    <div ref={rootRef} className="w-full py-1 pr-3 pl-4.75 sm:pl-5.75">
      <div className="bg-card flex w-full flex-col gap-2 rounded-md border p-2.5 font-sans">
        <div className="flex w-full flex-wrap gap-x-5 gap-y-1.5">
          {fields.map(([key, value]) => (
            <div key={key} className="flex min-w-0 flex-col">
              <p className="text-muted-more-foreground text-[0.65rem] font-medium tracking-wide uppercase">
                {key}
              </p>
              <p className="text-muted-foreground min-w-0 text-xs break-all select-text">{value}</p>
            </div>
          ))}
        </div>
        <div className="relative flex w-full">
          <p className="text-foreground bg-background min-w-0 flex-1 rounded border p-2 pr-10 font-mono text-xs break-all whitespace-pre-wrap select-text">
            {logLine.message}
          </p>
          <CopyButton
            valueToCopy={logLine.message}
            className="absolute top-0.5 right-0.5"
            classNameIcon="size-3.5"
          />
        </div>
        {rangeEnabled && hasActiveFilters && logLine.timestamp && (
          <div className="flex w-full justify-start">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => viewInContext(new Date(logLine.timestamp!).getTime())}
            >
              View in context
            </Button>
          </div>
        )}
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
