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

const SCROLL_THRESHOLD = 50;

type Props = {
  logs: TLogLine[];
  containerType: "page" | "sheet";
  className?: string;
};

export default function LogViewer({ logs, containerType }: Props) {
  return (
    <LogViewPreferencesProvider>
      <LogViewDropdownProvider>
        <Logs_ logs={logs} containerType={containerType} />
      </LogViewDropdownProvider>
    </LogViewPreferencesProvider>
  );
}

function Logs_({ logs, containerType }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<VListHandle>(null);
  const follow = useRef(true);
  const prevScrollY = useRef<number | null>(null);
  const scrolledOnce = useRef(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [isAtTop, setIsAtTop] = useState(false);

  const { preferences: viewPreferences } = useLogViewPreferences();
  const autoFollow = viewPreferences.includes(logViewPreferenceKeys.autoFollow);

  const scrollToTop = useCallback(() => {
    follow.current = false;

    const listElement = listRef.current;
    if (!listElement) return;
    listElement.scrollTo(0);
    return;
  }, []);

  const scrollToBottomTimeout = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = useCallback(() => {
    const scroll = () => {
      follow.current = true;
      const listElement = listRef.current;
      const containerElement = containerRef.current;
      if (!listElement || !containerElement) return;
      listElement.scrollTo(
        listElement.scrollSize - containerElement.clientHeight
      );
    };

    scroll();

    if (scrollToBottomTimeout.current) {
      clearTimeout(scrollToBottomTimeout.current);
    }
    scrollToBottomTimeout.current = setTimeout(() => {
      scroll();
    });
  }, []);

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

    const scrollY = listRef.current?.scrollOffset;
    if (scrollY === undefined) return;

    const elementHeight = containerRef.current?.clientHeight;
    if (elementHeight === undefined) return;

    const scrollHeight = listRef.current?.scrollSize;
    if (scrollHeight === undefined) return;

    const maxScroll = scrollHeight - elementHeight;
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

  const elements = useMemo(
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
    [logs, containerType]
  );

  return (
    <div className="w-full flex flex-col flex-1 min-h-0 overflow-hidden relative">
      {/* Top bar that has the input */}
      <div
        data-container={containerType}
        className="w-full flex items-stretch data-[container=page]:px-[max(0px,calc((100%-1280px-1.25rem)/2))]"
      >
        <TopBar className="px-2 pt-2 sm:px-2.5 sm:pt-2.5" />
      </div>
      {/* List */}
      <div className="w-full flex flex-col flex-1 min-h-0 overflow-hidden relative">
        <div
          ref={containerRef}
          className="w-full flex flex-col flex-1 min-h-0 overflow-hidden relative
          [mask-image:linear-gradient(to_bottom,transparent,black_0.75rem,black_calc(100%-0.75rem),transparent)]"
        >
          <VList
            overscan={10}
            data-container={containerType}
            style={{ height: undefined }}
            className="w-full flex-1 min-h-0 font-mono data-[container=page]:px-[max(0px,calc((100%-1280px)/2))]"
            ref={listRef}
            onScroll={throttledOnScroll}
          >
            {elements}
          </VList>
        </div>
        <NavigationBar
          data-container={containerType}
          className="hidden sm:flex right-2.5 sm:right-4 
            data-[container=page]:bottom-3 sm:data-[container=page]:bottom-[calc(1rem+var(--safe-area-inset-bottom))]
            data-[container=sheet]:bottom-[calc(0.75rem+var(--safe-area-inset-bottom))] sm:data-[container=sheet]:bottom-[calc(1rem+var(--safe-area-inset-bottom))]"
          isAtBottom={isAtBottom}
          isAtTop={isAtTop}
          scrollToBottom={scrollToBottom}
          scrollToTop={scrollToTop}
        />
      </div>
    </div>
  );
}
