"use client";

import ErrorLine from "@/components/error-line";
import LogLine from "@/components/logs/log-line";
import LogViewDropdownProvider from "@/components/logs/log-view-dropdown-provider";
import LogViewPreferencesProvider, {
  logViewPreferenceKeys,
  useLogViewPreferences,
} from "@/components/logs/log-view-preferences-provider";
import LogViewStateProvider, { useLogViewState } from "@/components/logs/log-view-state-provider";
import LogsProvider, {
  TDeploymentLogsProps,
  TEnvironmentLogsProps,
  TLogLineWithLevel,
  TLogsStreamProps,
  TServiceLogsProps,
  useLogs,
} from "@/components/logs/logs-provider";
import NavigationBar from "@/components/logs/navigation-bar";
import SearchBar from "@/components/logs/search-bar";
import NoItemsCard from "@/components/no-items-card";
import { useServices } from "@/components/project/services-provider";
import { TLogType } from "@/server/trpc/api/logs/types";
import { SearchIcon } from "lucide-react";
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
} & TLogsStreamProps;

type TProps = TBaseProps & (TEnvironmentLogsProps | TServiceLogsProps | TDeploymentLogsProps);

export default function LogViewer({
  hideServiceByDefault,
  teamId,
  projectId,
  environmentId,
  serviceId,
  deploymentId,
  type,
  containerType,
  streamDisabled,
  start,
  end,
  since,
}: TProps) {
  const typeAndIds: TEnvironmentLogsProps | TServiceLogsProps | TDeploymentLogsProps =
    type === "service"
      ? { type: "service", environmentId: environmentId, serviceId: serviceId }
      : type === "deployment"
        ? { type: "deployment", environmentId, serviceId, deploymentId }
        : { type: "environment", environmentId: environmentId };

  const streamProps: TLogsStreamProps = streamDisabled
    ? { streamDisabled: true, start, end }
    : start
      ? { start }
      : { since };

  return (
    <LogViewPreferencesProvider hideServiceByDefault={hideServiceByDefault}>
      <LogViewDropdownProvider>
        <LogViewStateProvider>
          <LogsProvider teamId={teamId} projectId={projectId} {...typeAndIds} {...streamProps}>
            <Logs containerType={containerType} />
          </LogsProvider>
        </LogViewStateProvider>
      </LogViewDropdownProvider>
    </LogViewPreferencesProvider>
  );
}

const SCROLL_THRESHOLD = 50;
const placeholderArray = Array.from({ length: 50 });

function Logs({ containerType }: { containerType: "page" | "sheet" }) {
  const { data, isPending, error } = useLogs();
  const logs: TLogLineWithLevel[] | undefined = useMemo(() => {
    if (!data) return undefined;
    return data.logs.map((logLine) => ({
      ...logLine,
      level: getLevelFromMessage(logLine.message),
    }));
  }, [data]);

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
          <ErrorLine message={error.message} withIcon />
        </div>
      );
    }
    if (!isPending && logs && logs.length === 0) {
      return (
        <div className="px-2 pt-2.5 pb-[calc(var(--safe-area-inset-bottom)+6.5rem)] font-sans group-data-[container=page]/wrapper:px-2 sm:px-2.5 group-data-[container=page]/wrapper:sm:px-2.5 group-data-[container=page]/wrapper:xl:px-[calc(0.625rem-((100vw-80rem)/2))]">
          <NoLogsFound data-container={containerType} />
        </div>
      );
    }
    if (!logs || !servicesData) {
      return placeholderArray.map((_, index) => (
        <LogLine
          isPlaceholder
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
        data-container={containerType}
        data-first={index === 0 ? true : undefined}
        data-last={index === logs.length - 1 ? true : undefined}
        classNameInner="min-[80.25rem]:group-data-[container=page]/line:rounded-sm"
        logLine={logLine}
        serviceName={
          servicesData.services.find((service) => service.id === logLine.metadata.service_id)
            ?.display_name ||
          logLine.metadata.service_id ||
          "Unknown"
        }
      />
    ));
  }, [logs, servicesData, containerType, error, isPending]);

  return (
    <LogViewStateProvider>
      <div
        data-container={containerType}
        className="group/wrapper relative flex min-h-0 w-full flex-1 flex-col overflow-hidden"
      >
        {/* Top bar that has the input */}
        <div className="flex w-full items-stretch group-data-[container=page]/wrapper:px-[max(0px,calc((100%-80rem-1.25rem)/2))]">
          <SearchBar isPendingLogs={isPending} className="px-2 pt-2 sm:px-2.5 sm:pt-2.5" />
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

function NoLogsFound() {
  const { search } = useLogViewState();
  return (
    <NoItemsCard Icon={SearchIcon}>
      <p className="w-full max-w-lg">
        {search ? (
          <>
            No matches for <span className="bg-border rounded px-1.5 font-medium">{search}</span>
          </>
        ) : (
          <>No logs found</>
        )}
      </p>
    </NoItemsCard>
  );
}

function getLevelFromMessage(message: string): TLogLineWithLevel["level"] {
  if (/(\s|^)(error|fatal|fail|failed)(\s|$)/i.test(message)) {
    return "error";
  }
  if (/(\s|^)(warn|warning)(\s|$)/i.test(message)) {
    return "warn";
  }
  return "info";
}
