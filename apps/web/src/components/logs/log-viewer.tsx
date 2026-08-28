"use client";

import ErrorCard from "@/components/error-card";
import ErrorLine from "@/components/error-line";
import LogLine from "@/components/logs/log-line";
import LogFiltersProvider from "@/components/logs/log-filters-provider";
import LogViewDropdownProvider from "@/components/logs/log-view-dropdown-provider";
import LogViewPreferencesProvider, {
  logViewPreferenceKeys,
  useLogViewPreferences,
} from "@/components/logs/log-view-preferences-provider";
import LogsProvider, {
  TDeploymentBuildLogsProps,
  TDeploymentLogsProps,
  TEnvironmentLogsProps,
  TServiceLogsProps,
  useLogs,
} from "@/components/logs/logs-provider";
import SearchBar from "@/components/logs/search-bar";
import TabWrapper from "@/components/navigation/tab-wrapper";
import NoItemsCard from "@/components/no-items-card";
import { useServices } from "@/components/service/services-provider";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/utils";
import { TLogType } from "@/lib/queries/logs";
import { ArrowDownIcon, HourglassIcon, LoaderIcon, SearchIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useThrottledCallback } from "use-debounce";
import { VList, VListHandle } from "virtua";

type TBaseProps = {
  containerType: "page" | "sheet";
  hideServiceByDefault?: boolean;
  className?: string;
  type: TLogType;
  teamId: string;
  projectId: string;
  shouldHaveLogs?: boolean;
  httpDefaultStartTimestamp?: number;
  httpDefaultEndTimestamp?: number;
  error?: string;
};

type TProps = TBaseProps &
  (TEnvironmentLogsProps | TServiceLogsProps | TDeploymentLogsProps | TDeploymentBuildLogsProps);

export default function LogViewer({
  hideServiceByDefault,
  teamId,
  projectId,
  environmentId,
  serviceId,
  deploymentId,
  type,
  containerType,
  shouldHaveLogs,
  httpDefaultStartTimestamp,
  httpDefaultEndTimestamp,
  error,
}: TProps) {
  const typeAndIds:
    | TEnvironmentLogsProps
    | TServiceLogsProps
    | TDeploymentLogsProps
    | TDeploymentBuildLogsProps =
    type === "service"
      ? { type: "service", environmentId: environmentId, serviceId }
      : type === "deployment"
        ? { type: "deployment", environmentId, serviceId, deploymentId }
        : type === "build"
          ? { type: "build", environmentId, serviceId, deploymentId }
          : { type: "environment", environmentId: environmentId };

  return (
    <LogViewPreferencesProvider storageKey={type} hideServiceByDefault={hideServiceByDefault}>
      <LogViewDropdownProvider>
        <LogFiltersProvider logType={type}>
          <LogsProvider
            teamId={teamId}
            projectId={projectId}
            httpDefaultEndTimestamp={httpDefaultEndTimestamp}
            httpDefaultStartTimestamp={httpDefaultStartTimestamp}
            {...typeAndIds}
          >
            <Logs
              error={error}
              containerType={containerType}
              type={type}
              shouldHaveLogs={shouldHaveLogs}
            />
          </LogsProvider>
        </LogFiltersProvider>
      </LogViewDropdownProvider>
    </LogViewPreferencesProvider>
  );
}

const SCROLL_THRESHOLD = 50;
const FETCH_OLDER_THRESHOLD = 300;
const placeholderArray = Array.from({ length: 50 });

function Logs({
  containerType,
  type,
  shouldHaveLogs,
  error: errorFromProp,
}: {
  containerType: "page" | "sheet";
  type: TLogType;
  shouldHaveLogs?: boolean;
  error?: string;
}) {
  const {
    logs,
    logsRef,
    isPending: isPendingRaw,
    isRefreshing,
    error,
    streamStatus,
    streamErrorMessage,
    isLive,
    hasMoreOlder,
    isFetchingOlder,
    fetchOlder,
    lastChange,
    searchError,
    setEvictionPaused,
  } = useLogs();

  // a search error disables fetching, so show "no matches" instead of skeletons
  const isPending = isPendingRaw && !searchError;
  const getLogsForDownload = useCallback(() => logsRef.current, [logsRef]);

  const virtualListRef = useRef<VListHandle>(null);
  const follow = useRef(true);
  const prevScrollY = useRef<number | null>(null);
  const scrolledOnce = useRef(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [expandedKeys, setExpandedKeys] = useState<ReadonlySet<string>>(new Set());

  const { preferences: viewPreferences } = useLogViewPreferences();
  const autoFollow = viewPreferences.includes(logViewPreferenceKeys.autoFollow);

  const {
    query: { data: servicesData },
  } = useServices();
  const serviceNamesById = useMemo(() => {
    const names = new Map<string, string>();
    for (const service of servicesData?.services ?? []) names.set(service.id, service.name);
    return names;
  }, [servicesData]);

  const scrollToBottom = useCallback(() => {
    follow.current = true;
    const virtualList = virtualListRef.current;
    if (!virtualList) return;
    virtualList.scrollToIndex((logs || placeholderArray).length + 1);
  }, [logs]);

  useEffect(() => {
    if (lastChange === "prepend") return;
    if (!follow.current) return;
    if (!autoFollow) return;

    scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs]);

  useEffect(() => {
    if (!autoFollow) return;
    scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFollow]);

  const toggleExpanded = useCallback((key: string) => {
    follow.current = false;
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const onScroll = useCallback(() => {
    // This is to prevent follow from being broken on initial load
    if (!scrolledOnce.current) {
      scrolledOnce.current = true;
      return;
    }

    const virtualList = virtualListRef.current;
    if (!virtualList) return;

    const scrollY = virtualList.scrollOffset;
    const maxScroll = virtualList.scrollSize - virtualList.viewportSize;

    const distanceToBottom = maxScroll - scrollY;
    const newIsAtBottom = distanceToBottom < SCROLL_THRESHOLD;

    // If the user scrolls up, stop following
    if (prevScrollY.current !== null && scrollY < prevScrollY.current) {
      follow.current = false;
    }

    prevScrollY.current = scrollY;

    if (newIsAtBottom) {
      follow.current = true;
      setIsAtBottom(true);
    } else {
      setIsAtBottom(false);
    }

    // eviction would yank away the history the user is reading
    setEvictionPaused(!newIsAtBottom);

    if (scrollY < FETCH_OLDER_THRESHOLD && hasMoreOlder && !isFetchingOlder) {
      fetchOlder();
    }
  }, [hasMoreOlder, isFetchingOlder, fetchOlder, setEvictionPaused]);

  const throttledOnScroll = useThrottledCallback(onScroll, 50);

  const listItems = useMemo(() => {
    if (!isPending && error && !logs) {
      return (
        <div className="w-full px-2 pt-2.5 pb-[calc(var(--safe-area-inset-bottom)+6.5rem)] font-sans group-data-[container=page]/wrapper:px-2 sm:px-2.5 group-data-[container=page]/wrapper:sm:px-2.5 group-data-[container=page]/wrapper:xl:px-[calc(0.625rem-((100vw-80rem)/2))]">
          <ErrorCard message={error.message} />
        </div>
      );
    }
    if (!isPending && (!logs || logs.length === 0) && searchError) {
      return (
        <div className="px-2 pt-2.5 pb-[calc(var(--safe-area-inset-bottom)+6.5rem)] font-sans group-data-[container=page]/wrapper:px-2 sm:px-2.5 group-data-[container=page]/wrapper:sm:px-2.5 group-data-[container=page]/wrapper:xl:px-[calc(0.625rem-((100vw-80rem)/2))]">
          <NoLogsFound data-container={containerType} />
        </div>
      );
    }
    if (!isPending && logs && logs.length === 0) {
      return (
        <div className="px-2 pt-2.5 pb-[calc(var(--safe-area-inset-bottom)+6.5rem)] font-sans group-data-[container=page]/wrapper:px-2 sm:px-2.5 group-data-[container=page]/wrapper:sm:px-2.5 group-data-[container=page]/wrapper:xl:px-[calc(0.625rem-((100vw-80rem)/2))]">
          <NoLogsFound
            data-container={containerType}
            shouldHaveLogs={shouldHaveLogs && !searchError}
          />
        </div>
      );
    }
    if (!logs || !servicesData) {
      return placeholderArray.map((_, index) => (
        <LogLine
          isPlaceholder
          type={type}
          key={index}
          data-container={containerType}
          data-first={index === 0 || undefined}
          data-last={index === placeholderArray.length - 1 || undefined}
          classNameInner="min-[80.25rem]:group-data-[container=page]/line:rounded-sm"
        />
      ));
    }
    return [
      hasMoreOlder ? (
        <OlderLogsIndicator key="older-logs" isFetching={isFetchingOlder} />
      ) : (
        <LogsStartIndicator key="logs-start" />
      ),
      ...logs.map((logLine, index) => (
        <LogLine
          key={logLine.key}
          type={type}
          data-container={containerType}
          data-last={index === logs.length - 1 || undefined}
          classNameInner="min-[80.25rem]:group-data-[container=page]/line:rounded-sm"
          logLine={logLine}
          isExpanded={expandedKeys.has(logLine.key)}
          onToggleExpanded={() => toggleExpanded(logLine.key)}
          serviceName={
            serviceNamesById.get(logLine.metadata.service_id ?? "") ||
            logLine.metadata.service_id ||
            "Unknown"
          }
        />
      )),
    ];
  }, [
    logs,
    servicesData,
    serviceNamesById,
    containerType,
    error,
    isPending,
    type,
    shouldHaveLogs,
    searchError,
    hasMoreOlder,
    isFetchingOlder,
    expandedKeys,
    toggleExpanded,
  ]);

  if (logs && logs.length === 0 && errorFromProp) {
    return (
      <ScrollArea>
        <TabWrapper>
          <ErrorLine message={errorFromProp} />
        </TabWrapper>
      </ScrollArea>
    );
  }

  return (
    <div
      data-container={containerType}
      className="group/wrapper relative flex min-h-0 w-full flex-1 flex-col overflow-hidden"
    >
      {/* Top bar that has the input */}
      <div className="flex w-full items-stretch group-data-[container=page]/wrapper:px-[max(0px,calc((100%-80rem-1.25rem)/2))]">
        <SearchBar
          logType={type}
          isPendingLogs={(isPending || isRefreshing) && !error}
          searchError={searchError}
          hasLogs={Boolean(logs && logs.length > 0)}
          getLogsForDownload={getLogsForDownload}
          className="px-2 pt-2 sm:px-2.5 sm:pt-2.5"
        />
      </div>
      {error && logs && logs.length > 0 && (
        <div className="w-full px-2 pt-1.5 group-data-[container=page]/wrapper:px-[max(0.5rem,calc((100%-80rem-1.25rem)/2))] sm:px-2.5">
          <ErrorLine message={error.message} />
        </div>
      )}
      {streamErrorMessage && (
        <div className="w-full px-2 pt-1.5 group-data-[container=page]/wrapper:px-[max(0.5rem,calc((100%-80rem-1.25rem)/2))] sm:px-2.5">
          <ErrorLine message={streamErrorMessage} />
        </div>
      )}
      {/* List */}
      <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden">
        <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden mask-[linear-gradient(to_bottom,transparent,black_0.75rem,black_calc(100%-0.75rem),transparent)]">
          <VList
            overscan={20}
            shift={lastChange === "prepend"}
            style={{ height: undefined }}
            className="min-h-0 w-full flex-1 font-mono group-data-[container=page]/wrapper:px-[max(0px,calc((100%-80rem)/2))]"
            ref={virtualListRef}
            onScroll={throttledOnScroll}
          >
            {listItems}
          </VList>
        </div>
        <StreamStatusChip
          isLive={isLive}
          streamStatus={streamStatus}
          className="absolute top-2 right-2.5 z-10 sm:right-4"
        />
        {logs && logs.length > 0 && (
          <Button
            type="button"
            size="sm"
            aria-label="Jump to latest"
            data-show={!isAtBottom || undefined}
            disabled={isAtBottom}
            fadeOnDisabled={false}
            onClick={scrollToBottom}
            className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 translate-y-[calc(100%+1.5rem+var(--safe-area-inset-bottom))] gap-1.5 rounded-full shadow-md transition-transform data-show:translate-y-0 sm:bottom-[calc(1rem+var(--safe-area-inset-bottom))]"
          >
            <ArrowDownIcon className="size-4" />
            Jump
          </Button>
        )}
      </div>
    </div>
  );
}

function StreamStatusChip({
  isLive,
  streamStatus,
  className,
}: {
  isLive: boolean;
  streamStatus: "idle" | "connecting" | "live" | "reconnecting" | "error";
  className?: string;
}) {
  const { label, tone } = useMemo(() => {
    if (!isLive) return { label: "Historical", tone: "muted" as const };
    if (streamStatus === "live") return { label: "Live", tone: "success" as const };
    if (streamStatus === "reconnecting") return { label: "Reconnecting", tone: "warning" as const };
    if (streamStatus === "error") return { label: "Disconnected", tone: "warning" as const };
    if (streamStatus === "idle") return { label: "Paused", tone: "muted" as const };
    return { label: "Connecting", tone: "muted" as const };
  }, [isLive, streamStatus]);

  return (
    <div
      data-tone={tone}
      className={cn(
        "bg-card text-muted-foreground pointer-events-none flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-sans text-xs leading-tight font-medium select-none",
        className,
      )}
    >
      <div
        data-tone={tone}
        className="bg-muted-more-foreground data-[tone=success]:bg-success data-[tone=warning]:bg-warning size-1.75 rounded-full data-[tone=success]:animate-pulse data-[tone=warning]:animate-pulse"
      />
      {label}
    </div>
  );
}

function OlderLogsIndicator({ isFetching }: { isFetching: boolean }) {
  return (
    <div className="text-muted-foreground flex w-full items-center justify-center gap-1.5 px-2 py-3 font-sans text-xs">
      <LoaderIcon
        data-fetching={isFetching || undefined}
        className="size-3.5 opacity-0 data-fetching:animate-spin data-fetching:opacity-100"
      />
      <p>{isFetching ? "Loading older logs" : "Scroll up for older logs"}</p>
    </div>
  );
}

function LogsStartIndicator() {
  return (
    <div className="text-muted-foreground flex w-full items-center gap-2 pt-3 pr-2.5 pb-2 pl-2 font-mono text-xs sm:pr-3 sm:pl-2.5 group-data-[container=page]/wrapper:xl:pr-[calc(0.75rem-((100vw-80rem)/2))] group-data-[container=page]/wrapper:xl:pl-[calc(0.625rem-((100vw-80rem)/2))]">
      <p className="left max-w-[calc(100%-4rem)] shrink-0 rounded-md border px-2 py-1">
        Start of the range
      </p>
      <div className="mask-squiggle bg-muted-more-foreground h-1.5 min-w-0 flex-1" />
    </div>
  );
}

function AnimatedHourglassIcon({ className }: { className?: string }) {
  return <HourglassIcon className={cn("animate-hourglass", className)} />;
}

function NoLogsFound({ shouldHaveLogs }: { shouldHaveLogs?: boolean }) {
  const { searchError } = useLogs();

  const Icon = useMemo(() => {
    if (shouldHaveLogs) return AnimatedHourglassIcon;
    return SearchIcon;
  }, [shouldHaveLogs]);

  return (
    <NoItemsCard Icon={Icon}>
      <p className="w-full max-w-lg">
        {searchError ? (
          <>{searchError}</>
        ) : shouldHaveLogs ? (
          <>Waiting for logs</>
        ) : (
          <>No logs match the current filters</>
        )}
      </p>
    </NoItemsCard>
  );
}
