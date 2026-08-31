"use client";

import ErrorCard from "@/components/error-card";
import ErrorLine from "@/components/error-line";
import LogFiltersProvider, { useLogFilters } from "@/components/logs/log-filters-provider";
import LogLine from "@/components/logs/log-line";
import { buildLogRows, type TLogRow } from "@/components/logs/log-rows";
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
import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";
import {
  ArrowDownIcon,
  HourglassIcon,
  LoaderIcon,
  RotateCcwIcon,
  RotateCwIcon,
  SearchIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useThrottledCallback } from "use-debounce";

type TContainerType = "page" | "sheet";

type TBaseProps = {
  containerType: TContainerType;
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
    TEnvironmentLogsProps | TServiceLogsProps | TDeploymentLogsProps | TDeploymentBuildLogsProps =
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
const ESTIMATED_ROW_HEIGHT = 28;
const OVERSCAN = 12;
const placeholderArray = Array.from({ length: 50 });

function Logs({
  containerType,
  type,
  shouldHaveLogs,
  error: errorFromProp,
}: {
  containerType: TContainerType;
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
    mode,
    isStreamConnected,
    streamFatalError,
    streamErrorMessage,
    searchError,
  } = useLogs();

  // a search error disables fetching, so show "no matches" instead of skeletons
  const isPending = isPendingRaw && !searchError;
  const getLogsForDownload = useCallback(() => logsRef.current, [logsRef]);

  const {
    query: { data: servicesData },
  } = useServices();
  const serviceNamesById = useMemo(() => {
    const names = new Map<string, string>();
    for (const service of servicesData?.services ?? []) names.set(service.id, service.name);
    return names;
  }, [servicesData]);

  const isEmpty = Boolean(logs && logs.length === 0);
  // log lines only render once service names are in, so skeletons stay up until
  // then, though a result with no lines has no names to wait for
  const isShowingPlaceholders = !logs || (!servicesData && !isEmpty);
  const rows = useMemo(() => buildLogRows(logs ?? []), [logs]);

  if (isEmpty && errorFromProp) {
    return (
      <ScrollArea>
        <TabWrapper>
          <ErrorLine message={errorFromProp} />
        </TabWrapper>
      </ScrollArea>
    );
  }

  const isPage = containerType === "page";
  const listProps = { rows, type, containerType, serviceNamesById, isEmpty };

  const renderContent = () => {
    if (!isPending && error && !logs) {
      return (
        <CenteredCard>
          <ErrorCard message={error.message} className="min-h-38" />
        </CenteredCard>
      );
    }
    // nothing has ever loaded, so the search error is all there is to show
    if (!isPending && !logs && searchError) {
      return (
        <CenteredCard>
          <NoLogsFound />
        </CenteredCard>
      );
    }
    if (isShowingPlaceholders) {
      return <PlaceholderList type={type} containerType={containerType} />;
    }
    // The list hides rather than unmounts while empty, so a filter that matches
    // nothing doesn't tear down the virtualizer and the scroll state with it.
    return (
      <>
        <LogList {...listProps} />
        {isEmpty && (
          <CenteredCard>
            <NoLogsFound shouldHaveLogs={shouldHaveLogs && !searchError} />
          </CenteredCard>
        )}
      </>
    );
  };

  return (
    <div
      data-container={containerType}
      className={cn(
        "group/wrapper relative flex min-h-0 w-full flex-col overflow-hidden",
        // The navbar is in flow at the top from sm up and fixed to the bottom
        // below it, so the same subtraction leaves the page exactly clear of it.
        isPage ? "h-[calc(100svh-var(--navbar-height))]" : "flex-1",
      )}
    >
      <div className="relative flex w-full shrink-0 items-stretch group-data-[container=page]/wrapper:px-[max(0px,calc((100%-80rem-1.25rem)/2))]">
        <div className="relative w-full">
          <SearchBar
            logType={type}
            isPendingLogs={(isPending || isRefreshing) && !error}
            searchError={searchError}
            hasLogs={Boolean(logs && logs.length > 0)}
            getLogsForDownload={getLogsForDownload}
            className="z-20 px-2 pt-2 sm:px-2.5 sm:pt-2.5"
          />
          <StreamStatusChip
            mode={mode}
            isConnected={isStreamConnected}
            isError={Boolean(streamFatalError || (error && !logs))}
            className="absolute right-2 bottom-0 z-10 translate-y-[calc(100%+0.5rem)] sm:right-2.5"
          />
        </div>
      </div>
      {error && logs && logs.length > 0 && (
        <div className="w-full shrink-0 pt-2 group-data-[container=page]/wrapper:px-[max(0px,calc((100%-80rem-1.25rem)/2))]">
          <div className="w-full px-2 sm:px-2.5">
            <ErrorLine className="border-destructive/8 border py-1.25" message={error.message} />
          </div>
        </div>
      )}
      {streamErrorMessage && (
        <div className="w-full shrink-0 pt-2 group-data-[container=page]/wrapper:px-[max(0px,calc((100%-80rem-1.25rem)/2))]">
          <div className="w-full px-2 sm:px-2.5">
            <ErrorLine
              className="border-destructive/8 border py-1.25"
              message={streamErrorMessage}
            />
          </div>
        </div>
      )}
      {renderContent()}
    </div>
  );
}

type TRowsProps = {
  rows: TLogRow[];
  type: TLogType;
  containerType: TContainerType;
  serviceNamesById: Map<string, string>;
};

type TListProps = TRowsProps & { isEmpty: boolean };

function LogList({ rows, type, containerType, serviceNamesById, isEmpty }: TListProps) {
  const { hasMoreOlder, isFetchingOlder, olderError, fetchOlder, setEvictionPaused, resultSetKey } =
    useLogs();
  const autoFollow = useAutoFollow();

  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const { expandedKeys, toggleExpanded } = useExpandedKeys();

  const virtualizer = useVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    getItemKey: (index) => rows[index]!.key,
    overscan: OVERSCAN,
    anchorTo: "end",
    followOnAppend: autoFollow,
    scrollEndThreshold: SCROLL_THRESHOLD,
  });

  // followOnAppend only reacts to the list growing, so the first render, a new
  // result set, and switching the toggle back on have to pin to the bottom by hand.
  useEffect(() => {
    if (!autoFollow) return;
    virtualizer.scrollToEnd();
  }, [autoFollow, virtualizer, resultSetKey]);

  const syncScrollState = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    const distanceToBottom = element.scrollHeight - element.clientHeight - element.scrollTop;
    const atBottom = distanceToBottom < SCROLL_THRESHOLD;
    setIsAtBottom(atBottom);
    // eviction would yank away the history the user is reading
    setEvictionPaused(!atBottom);

    // a failed page disarms this until the user retries by hand
    if (
      element.scrollTop < FETCH_OLDER_THRESHOLD &&
      hasMoreOlder &&
      !isFetchingOlder &&
      !olderError
    ) {
      fetchOlder();
    }
  }, [hasMoreOlder, isFetchingOlder, olderError, fetchOlder, setEvictionPaused]);

  const throttledSyncScrollState = useThrottledCallback(syncScrollState, 50);

  // Growing the list moves the bottom without emitting a scroll event
  useEffect(() => {
    throttledSyncScrollState();
  }, [rows.length, throttledSyncScrollState]);

  return (
    <div
      data-empty={isEmpty || undefined}
      className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden data-empty:hidden"
    >
      <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden mask-[linear-gradient(to_bottom,transparent,black_0.75rem,black_calc(100%-0.75rem),transparent)]">
        <div
          ref={scrollRef}
          onScroll={throttledSyncScrollState}
          className="min-h-0 w-full flex-1 overflow-y-auto font-mono [overflow-anchor:none]"
        >
          {/* The width cap lives inside the scroller so the scrollbar stays at the
              container edge and the fade spans the full width. */}
          <div className="w-full group-data-[container=page]/wrapper:px-[max(0px,calc((100%-80rem)/2))]">
            <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
              <VirtualRows
                items={virtualizer.getVirtualItems()}
                measureElement={virtualizer.measureElement}
                rows={rows}
                type={type}
                containerType={containerType}
                serviceNamesById={serviceNamesById}
                expandedKeys={expandedKeys}
                onToggleExpanded={toggleExpanded}
                hasMoreOlder={hasMoreOlder}
                isFetchingOlder={isFetchingOlder}
                olderError={olderError}
                onRetryOlder={fetchOlder}
              />
            </div>
          </div>
        </div>
      </div>
      <JumpToLatestButton
        isAtBottom={isAtBottom}
        onClick={() => virtualizer.scrollToEnd()}
        className={cn(
          "absolute bottom-3 z-10 translate-y-[calc(100%+1.5rem)] sm:bottom-4",
          // The sheet reaches the bottom of the screen, the page stops above the navbar
          containerType === "sheet" &&
            "translate-y-[calc(100%+1.5rem+var(--safe-area-inset-bottom))] sm:bottom-[calc(1rem+var(--safe-area-inset-bottom))]",
        )}
      />
    </div>
  );
}

function useAutoFollow() {
  const { preferences } = useLogViewPreferences();
  return preferences.includes(logViewPreferenceKeys.autoFollow);
}

function useExpandedKeys() {
  const [expandedKeys, setExpandedKeys] = useState<ReadonlySet<string>>(new Set());
  const toggleExpanded = useCallback((key: string) => {
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
  return { expandedKeys, toggleExpanded };
}

type TVirtualRowsProps = TRowsProps & {
  items: VirtualItem[];
  measureElement: (node: HTMLDivElement | null) => void;
  expandedKeys: ReadonlySet<string>;
  onToggleExpanded: (key: string) => void;
  hasMoreOlder: boolean;
  isFetchingOlder: boolean;
  olderError: string | null;
  onRetryOlder: () => void;
};

function VirtualRows({
  items,
  measureElement,
  rows,
  type,
  containerType,
  serviceNamesById,
  expandedKeys,
  onToggleExpanded,
  hasMoreOlder,
  isFetchingOlder,
  olderError,
  onRetryOlder,
}: TVirtualRowsProps) {
  return items.map((item) => {
    const row = rows[item.index];
    if (!row) return null;

    return (
      <div
        key={item.key}
        data-index={item.index}
        ref={measureElement}
        className="absolute top-0 left-0 w-full"
        style={{ transform: `translateY(${item.start}px)` }}
      >
        {row.kind === "leading" ? (
          hasMoreOlder ? (
            <OlderLogsIndicator
              isFetching={isFetchingOlder}
              error={olderError}
              onRetry={onRetryOlder}
            />
          ) : (
            <LogsStartIndicator />
          )
        ) : (
          <LogLine
            type={type}
            data-container={containerType}
            data-last={item.index === rows.length - 1 || undefined}
            classNameInner="min-[81.25rem]:group-data-[container=page]/line:rounded-sm"
            logLine={row.line}
            isExpanded={expandedKeys.has(row.key)}
            onToggleExpanded={() => onToggleExpanded(row.key)}
            serviceName={
              serviceNamesById.get(row.line.metadata.service_id ?? "") ||
              row.line.metadata.service_id ||
              "Unknown"
            }
          />
        )}
      </div>
    );
  });
}

function PlaceholderList({
  type,
  containerType,
}: {
  type: TLogType;
  containerType: TContainerType;
}) {
  return (
    <div className="min-h-0 w-full flex-1 overflow-hidden font-mono group-data-[container=page]/wrapper:px-[max(0px,calc((100%-80rem)/2))]">
      {placeholderArray.map((_, index) => (
        <LogLine
          isPlaceholder
          type={type}
          key={index}
          data-container={containerType}
          data-first={index === 0 || undefined}
          data-last={index === placeholderArray.length - 1 || undefined}
          classNameInner="min-[81.25rem]:group-data-[container=page]/line:rounded-sm"
        />
      ))}
    </div>
  );
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-0 w-full flex-1 overflow-y-auto group-data-[container=page]/wrapper:px-[max(0px,calc((100%-80rem-1.25rem)/2))]">
      <div className="w-full px-2 py-2 font-sans sm:px-2.5">{children}</div>
    </div>
  );
}

function JumpToLatestButton({
  isAtBottom,
  onClick,
  className,
}: {
  isAtBottom: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <Button
      type="button"
      size="icon"
      aria-label="Jump to latest"
      data-show={!isAtBottom || undefined}
      disabled={isAtBottom}
      fadeOnDisabled={false}
      onClick={onClick}
      className={cn(
        "left-1/2 size-9 -translate-x-1/2 rounded-full shadow-md transition-transform data-show:translate-y-0",
        className,
      )}
    >
      <ArrowDownIcon className="size-5" />
    </Button>
  );
}

function OlderLogsIndicator({
  isFetching,
  error,
  onRetry,
}: {
  isFetching: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (error) {
    return (
      <div className="flex w-full flex-col items-start gap-2 px-2 pt-4 pb-2.5 font-sans sm:px-2.5">
        <ErrorLine
          withIcon
          className="border-destructive/8 border py-1.25"
          message={`Couldn't load older logs. ${error}`}
        />
        <Button size="sm" variant="outline" onClick={onRetry}>
          <RotateCwIcon className="-ml-1.5 size-4" />
          <p className="truncate leading-tight">Retry</p>
        </Button>
      </div>
    );
  }

  return (
    <div className="text-muted-foreground flex w-full items-center justify-center gap-1.5 px-2 pt-4 pb-2.5 font-sans text-xs">
      <LoaderIcon
        data-fetching={isFetching || undefined}
        className="size-3.5 opacity-0 data-fetching:animate-spin data-fetching:opacity-100"
      />
      <p className="min-w-0 shrink">
        {isFetching ? "Loading older logs" : "Scroll up for older logs"}
      </p>
    </div>
  );
}

function LogsStartIndicator() {
  return (
    <div className="text-muted-foreground flex w-full items-center gap-2 pt-2.25 pr-2.5 pb-2 pl-2 font-mono text-xs sm:pr-3 sm:pl-2.5 group-data-[container=page]/wrapper:xl:pr-[calc(0.75rem-((100vw-80rem)/2))] group-data-[container=page]/wrapper:xl:pl-[calc(0.625rem-((100vw-80rem)/2))]">
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
  const { hasActiveFilters, resetFilters } = useLogFilters();

  const Icon = useMemo(() => {
    if (shouldHaveLogs) return AnimatedHourglassIcon;
    return SearchIcon;
  }, [shouldHaveLogs]);

  return (
    <NoItemsCard Icon={Icon} className="min-h-42">
      <p className="w-full max-w-lg">
        {searchError ? (
          <>{searchError}</>
        ) : shouldHaveLogs ? (
          <>Waiting for logs</>
        ) : (
          <>No logs match the current filters</>
        )}
      </p>
      {hasActiveFilters && (
        <Button className="mt-2" onClick={() => resetFilters()}>
          <RotateCcwIcon className="-ml-1 size-5 shrink-0" />
          <p className="min-w-0 shrink">Clear Filters</p>
        </Button>
      )}
    </NoItemsCard>
  );
}

function StreamStatusChip({
  mode,
  isConnected,
  isError,
  className,
}: {
  mode: "live" | "historical";
  isConnected: boolean;
  isError: boolean;
  className?: string;
}) {
  const { label, tone } = useMemo(() => {
    if (isError) return { label: "Error", tone: "warning" as const };
    // a fixed window can't grow, so there is nothing to connect to and nothing
    // the first page landing would change about that
    if (mode === "historical") return { label: "Historical", tone: "process" as const };
    if (isConnected) return { label: "Live", tone: "success" as const };
    return { label: "Connecting", tone: "warning" as const };
  }, [mode, isConnected, isError]);

  return (
    <div
      data-tone={tone}
      className={cn(
        "bg-card text-muted-foreground data-[tone=success]:text-success data-[tone=warning]:text-warning data-[tone=process]:text-process group/chip pointer-events-none flex max-w-[calc(min(30%,10rem))] items-center gap-1.5 rounded-md border px-2.5 py-0.75 font-sans text-sm leading-tight font-semibold select-none",
        className,
      )}
    >
      <div className="bg-muted-more-foreground group-data-[tone=success]/chip:bg-success group-data-[tone=warning]/chip:bg-warning group-data-[tone=process]/chip:bg-process -ml-0.5 size-1.75 shrink-0 rounded-full" />
      <p className="min-w-0 shrink truncate">{label}</p>
    </div>
  );
}
