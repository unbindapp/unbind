"use client";

import LogLine, { TLogLine } from "@/components/logs/log-line";
import LogViewDropdownProvider from "@/components/logs/log-view-dropdown-provider";
import LogViewPreferencesProvider, {
  logViewPreferenceKeys,
  useLogViewPreferences,
} from "@/components/logs/log-view-preferences-provider";
import NavigationBar from "@/components/logs/navigation-bar";
import TopBar from "@/components/logs/top-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useThrottledCallback } from "use-debounce";
import { VList, VListHandle } from "virtua";

type Props = {
  logs: TLogLine[];
  containerType: "page" | "sheet";
  hideServiceByDefault?: boolean;
  className?: string;
};

export default function LogViewer({ logs, hideServiceByDefault, containerType }: Props) {
  return (
    <LogViewPreferencesProvider hideServiceByDefault={hideServiceByDefault}>
      <LogViewDropdownProvider>
        <Logs_ logs={logs} containerType={containerType} />
      </LogViewDropdownProvider>
    </LogViewPreferencesProvider>
  );
}

const SCROLL_THRESHOLD = 50;

function Logs_({ logs, containerType }: Props) {
  const virtualListRef = useRef<VListHandle>(null);
  const follow = useRef(true);
  const prevScrollY = useRef<number | null>(null);
  const scrolledOnce = useRef(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [isAtTop, setIsAtTop] = useState(false);

  const { preferences: viewPreferences } = useLogViewPreferences();
  const autoFollow = viewPreferences.includes(logViewPreferenceKeys.autoFollow);

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
    virtualList.scrollToIndex(logs.length - 1);
  }, [logs]);

  useEffect(() => {
    if (!autoFollow) return;
    scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFollow]);

  useEffect(() => {
    if (!follow.current) return;
    if (!autoFollow) return;

    scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs]);

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

  const listItems = useMemo(
    () =>
      logs.map((logLine, index) => (
        <LogLine
          key={index}
          data-container={containerType}
          data-first={index === 0 ? true : undefined}
          data-last={index === logs.length - 1 ? true : undefined}
          logLine={logLine}
          classNameInner="min-[1288px]:group-data-[container=page]/line:rounded-sm"
        />
      )),
    [logs, containerType],
  );

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden">
      {/* Top bar that has the input */}
      <div
        data-container={containerType}
        className="flex w-full items-stretch data-[container=page]:px-[max(0px,calc((100%-1280px-1.25rem)/2))]"
      >
        <TopBar className="px-2 pt-2 sm:px-2.5 sm:pt-2.5" />
      </div>
      {/* List */}
      <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden">
        <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_0.75rem,black_calc(100%-0.75rem),transparent)]">
          <VList
            reverse
            overscan={20}
            data-container={containerType}
            style={{ height: undefined }}
            className="min-h-0 w-full flex-1 font-mono data-[container=page]:px-[max(0px,calc((100%-1280px)/2))]"
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
  );
}
