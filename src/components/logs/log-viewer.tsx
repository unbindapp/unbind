"use client";

import ErrorCard from "@/components/error-card";
import ErrorLine from "@/components/error-line";
import LogLine from "@/components/logs/log-line";
import LogViewDropdownProvider from "@/components/logs/log-view-dropdown-provider";
import LogViewPreferencesProvider, {
  logViewPreferenceKeys,
  useLogViewPreferences,
} from "@/components/logs/log-view-preferences-provider";
import LogViewStateProvider, { useLogViewState } from "@/components/logs/log-view-state-provider";
import LogsProvider, {
  TDeploymentBuildLogsProps,
  TDeploymentLogsProps,
  TEnvironmentLogsProps,
  TServiceLogsProps,
  useLogs,
} from "@/components/logs/logs-provider";
import NavigationBar from "@/components/logs/navigation-bar";
import SearchBar from "@/components/logs/search-bar";
import TabWrapper from "@/components/navigation/tab-wrapper";
import NoItemsCard from "@/components/no-items-card";
import { useServices } from "@/components/service/services-provider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/utils";
import { TLogType } from "@/server/trpc/api/logs/types";
import { HourglassIcon, SearchIcon } from "lucide-react";
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
    <LogViewPreferencesProvider hideServiceByDefault={hideServiceByDefault}>
      <LogViewDropdownProvider>
        <LogViewStateProvider>
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
        </LogViewStateProvider>
      </LogViewDropdownProvider>
    </LogViewPreferencesProvider>
  );
}

const SCROLL_THRESHOLD = 50;
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
  const { data: logs, isPending, error } = useLogs();

  const virtualListRef = useRef<VListHandle>(null);
  const follow = useRef(true);
  const prevScrollY = useRef<number | null>(null);
  const scrolledOnce = useRef(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [isAtTop, setIsAtTop] = useState(false);

  const { preferences: viewPreferences } = useLogViewPreferences();
  const autoFollow = viewPreferences.includes(logViewPreferenceKeys.autoFollow);

  const {
    query: { data: servicesData },
  } = useServices();

  const scrollToTop = useCallback(() => {
    follow.current = false;
    const virtualList = virtualListRef.current;
    if (!virtualList) return;
    virtualList.scrollToIndex(0);
    return;
  }, []);

  const scrollToBottom = useCallback(() => {
    follow.current = true;
    const virtualList = virtualListRef.current;
    if (!virtualList) return;
    virtualList.scrollToIndex((logs || placeholderArray).length - 1);
  }, [logs]);

  useEffect(() => {
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
    const newIsAtTop = scrollY < SCROLL_THRESHOLD;

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

    if (newIsAtTop) {
      setIsAtTop(true);
    } else {
      setIsAtTop(false);
    }
  }, []);

  const throttledOnScroll = useThrottledCallback(onScroll, 50);

  const listItems = useMemo(() => {
    if (!isPending && error && !logs) {
      return (
        <div className="w-full px-2 pt-2.5 pb-[calc(var(--safe-area-inset-bottom)+6.5rem)] font-sans group-data-[container=page]/wrapper:px-2 sm:px-2.5 group-data-[container=page]/wrapper:sm:px-2.5 group-data-[container=page]/wrapper:xl:px-[calc(0.625rem-((100vw-80rem)/2))]">
          <ErrorCard message={error.message} />
        </div>
      );
    }
    if (!isPending && logs && logs.length === 0) {
      return (
        <div className="px-2 pt-2.5 pb-[calc(var(--safe-area-inset-bottom)+6.5rem)] font-sans group-data-[container=page]/wrapper:px-2 sm:px-2.5 group-data-[container=page]/wrapper:sm:px-2.5 group-data-[container=page]/wrapper:xl:px-[calc(0.625rem-((100vw-80rem)/2))]">
          <NoLogsFound data-container={containerType} shouldHaveLogs={shouldHaveLogs} />
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
          data-first={index === 0 ? true : undefined}
          data-last={index === placeholderArray.length - 1 ? true : undefined}
          classNameInner="min-[80.25rem]:group-data-[container=page]/line:rounded-sm"
        />
      ));
    }
    return logs.map((logLine, index) => (
      <LogLine
        key={index}
        type={type}
        data-container={containerType}
        data-first={index === 0 ? true : undefined}
        data-last={index === logs.length - 1 ? true : undefined}
        classNameInner="min-[80.25rem]:group-data-[container=page]/line:rounded-sm"
        logLine={logLine}
        serviceName={
          servicesData.services.find((service) => service.id === logLine.metadata.service_id)
            ?.name ||
          logLine.metadata.service_id ||
          "Unknown"
        }
      />
    ));
  }, [logs, servicesData, containerType, error, isPending, type, shouldHaveLogs]);

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
    <LogViewStateProvider>
      <div
        data-container={containerType}
        className="group/wrapper relative flex min-h-0 w-full flex-1 flex-col overflow-hidden"
      >
        {/* Top bar that has the input */}
        <div className="flex w-full items-stretch group-data-[container=page]/wrapper:px-[max(0px,calc((100%-80rem-1.25rem)/2))]">
          <SearchBar
            logType={type}
            isPendingLogs={isPending}
            className="px-2 pt-2 sm:px-2.5 sm:pt-2.5"
          />
        </div>
        {/* List */}
        <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden">
          <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_0.75rem,black_calc(100%-0.75rem),transparent)]">
            <VList
              overscan={20}
              style={{ height: undefined }}
              className="min-h-0 w-full flex-1 font-mono group-data-[container=page]/wrapper:px-[max(0px,calc((100%-80rem)/2))]"
              ref={virtualListRef}
              onScroll={throttledOnScroll}
            >
              {listItems}
            </VList>
          </div>
          <NavigationBar
            data-container={containerType}
            className="right-2.5 hidden data-[container=page]:bottom-3 data-[container=sheet]:bottom-[calc(0.75rem+var(--safe-area-inset-bottom))] sm:right-4 sm:flex sm:data-[container=page]:bottom-[calc(1rem+var(--safe-area-inset-bottom))] sm:data-[container=sheet]:bottom-[calc(1rem+var(--safe-area-inset-bottom))]"
            isAtBottom={isAtBottom}
            isAtTop={isAtTop}
            scrollToBottom={scrollToBottom}
            scrollToTop={scrollToTop}
          />
        </div>
      </div>
    </LogViewStateProvider>
  );
}

function AnimatedHourglassIcon({ className }: { className?: string }) {
  return <HourglassIcon className={cn("animate-hourglass", className)} />;
}

function NoLogsFound({ shouldHaveLogs }: { shouldHaveLogs?: boolean }) {
  const { search } = useLogViewState();

  const Icon = useMemo(() => {
    if (shouldHaveLogs) return AnimatedHourglassIcon;
    return SearchIcon;
  }, [shouldHaveLogs]);

  return (
    <NoItemsCard Icon={Icon}>
      <p className="w-full max-w-lg">
        {search ? (
          <>
            No matches for <span className="bg-border rounded px-1.5 font-medium">{search}</span>
          </>
        ) : shouldHaveLogs ? (
          <>Waiting for logs</>
        ) : (
          <>No logs found</>
        )}
      </p>
    </NoItemsCard>
  );
}
