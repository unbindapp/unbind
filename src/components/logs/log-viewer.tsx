"use client";

import LogLine from "@/components/logs/log-line";
import LogViewDropdownProvider from "@/components/logs/log-view-dropdown-provider";
import LogViewPreferencesProvider, {
  logViewPreferenceKeys,
  useLogViewPreferences,
} from "@/components/logs/log-view-preferences-provider";
import LogViewStateProvider, { useLogViewState } from "@/components/logs/log-view-state-provider";
import NavigationBar from "@/components/logs/navigation-bar";
import SearchBar from "@/components/logs/search-bar";
import { createSearchFilter } from "@/components/logs/search-filter";
import { useServices } from "@/components/project/services-provider";
import { env } from "@/lib/env";
import { useLogs } from "@/lib/hooks/use-logs";
import { SearchIcon } from "lucide-react";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useThrottledCallback } from "use-debounce";
import { VList, VListHandle } from "virtua";

type TBaseProps = {
  containerType: "page" | "sheet";
  hideServiceByDefault?: boolean;
  className?: string;
  type: "team" | "project" | "environment" | "service";
  teamId: string;
  projectId: string;
  environmentId: string;
  serviceId?: string;
};

type TProps = TBaseProps &
  (
    | {
        type: "environment";
        environmentId: string;
        serviceId?: never;
      }
    | {
        type: "service";
        environmentId: string;
        serviceId: string;
      }
  );

export default function LogViewer({ hideServiceByDefault, ...rest }: TProps) {
  return (
    <LogViewPreferencesProvider hideServiceByDefault={hideServiceByDefault}>
      <LogViewDropdownProvider>
        <LogViewStateProvider>
          <Logs {...rest} />
        </LogViewStateProvider>
      </LogViewDropdownProvider>
    </LogViewPreferencesProvider>
  );
}

const SCROLL_THRESHOLD = 50;
const placeholderArray = Array.from({ length: 50 });

function Logs({ containerType, type, teamId, projectId, environmentId, serviceId }: TProps) {
  const { data: session } = useSession();
  const { search } = useLogViewState();

  const filtersStr = createSearchFilter(search);

  const urlParams = useMemo(() => {
    const params = new URLSearchParams({
      team_id: teamId,
      project_id: projectId,
      environment_id: environmentId,
      type: type,
      tail: "1000",
      since: "24h",
    });
    if (type === "service") {
      params.set("service_id", serviceId);
    }
    if (filtersStr) {
      params.set("filters", filtersStr);
    }
    return params;
  }, [teamId, projectId, environmentId, serviceId, type, filtersStr]);

  const sseUrl = `${env.NEXT_PUBLIC_UNBIND_API_URL}/logs/stream?${urlParams.toString()}`;

  const sseQueryProps = useMemo(() => {
    const params: Parameters<typeof useLogs>[0] = {
      sseUrl,
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
      },
      enabled: session ? true : false,
    };
    return params;
  }, [sseUrl, session]);

  const { data: logs, isPending: isPendingLogs } = useLogs(sseQueryProps);

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
    if (!logs || !servicesData) {
      return placeholderArray.map((_, index) => (
        <LogLine
          isPlaceholder
          key={index}
          data-container={containerType}
          data-first={index === 0 ? true : undefined}
          data-last={index === placeholderArray.length - 1 ? true : undefined}
          classNameInner="min-[1288px]:group-data-[container=page]/line:rounded-sm"
        />
      ));
    }
    return logs.map((logLine, index) => (
      <LogLine
        key={index}
        data-container={containerType}
        data-first={index === 0 ? true : undefined}
        data-last={index === logs.length - 1 ? true : undefined}
        classNameInner="min-[1288px]:group-data-[container=page]/line:rounded-sm"
        logLine={logLine}
        serviceName={
          servicesData.services.find((service) => service.id === logLine.metadata.service_id)
            ?.display_name || logLine.metadata.service_id
        }
      />
    ));
  }, [logs, servicesData, containerType]);

  return (
    <LogViewStateProvider>
      <div
        data-container={containerType}
        className="group/wrapper relative flex min-h-0 w-full flex-1 flex-col overflow-hidden"
      >
        {/* Top bar that has the input */}
        <div className="flex w-full items-stretch group-data-[container=page]/wrapper:px-[max(0px,calc((100%-1280px-1.25rem)/2))]">
          <SearchBar isPendingLogs={isPendingLogs} className="px-2 pt-2 sm:px-2.5 sm:pt-2.5" />
        </div>
        {/* List */}
        <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden">
          <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_0.75rem,black_calc(100%-0.75rem),transparent)]">
            {!isPendingLogs && listItems.length === 0 && <NoLogsFound />}
            {(isPendingLogs || listItems.length > 0) && (
              <VList
                overscan={20}
                style={{ height: undefined }}
                className="min-h-0 w-full flex-1 font-mono group-data-[container=page]/wrapper:px-[max(0px,calc((100%-1280px)/2))]"
                ref={virtualListRef}
                onScroll={throttledOnScroll}
              >
                {listItems}
              </VList>
            )}
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
    <div className="text-muted-foreground flex w-full flex-col items-center gap-2 group-data-[container=page]/wrapper:px-[max(0px,calc((100%-1280px)/2))]">
      <div className="flex w-full max-w-3xl flex-col items-center justify-center px-4 py-8">
        <SearchIcon className="size-8 shrink-0" />
        <div className="mt-3 flex w-full flex-col items-center">
          {search ? (
            <p className="max-w-full text-center">
              No matches for <span className="bg-border rounded px-1.5 font-medium">{search}</span>
            </p>
          ) : (
            <p className="max-w-full text-center">No logs found</p>
          )}
        </div>
      </div>
    </div>
  );
}
