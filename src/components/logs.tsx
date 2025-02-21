"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { format as fnsFormat } from "date-fns";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import {
  ComponentProps,
  ReactNode,
  Ref,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useThrottledCallback } from "use-debounce";
import { useEventListener } from "usehooks-ts";
import { VList, VListHandle, WindowVirtualizer } from "virtua";

export type TLogLine = {
  level: "info" | "warn" | "error";
  timestamp: number;
  message: string;
  deploymentId: string;
  serviceId: string;
};

type Props = {
  logs: TLogLine[];
  virtualizerType?: "div" | "window";
  className?: string;
};

const SCROLL_THRESHOLD = 50;

export default function Logs({ virtualizerType, logs }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<VListHandle>(null);
  const [follow, setFollow] = useState(true);
  const prevScrollY = useRef<number | null>(null);
  const [scrolledOnce, setScrolledOnce] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [isAtTop, setIsAtTop] = useState(false);

  const scrollToTop = useCallback(() => {
    setFollow(false);

    if (virtualizerType === "div") {
      const listElement = listRef.current;
      if (!listElement) return;
      listElement.scrollTo(0);
      return;
    }

    window.scrollTo(0, 0);
  }, [virtualizerType]);

  const scrollToBottom = useCallback(() => {
    setFollow(true);

    if (virtualizerType === "div") {
      const listElement = listRef.current;
      const containerElement = containerRef.current;
      if (!listElement || !containerElement) return;
      listElement.scrollTo(
        listElement.scrollSize - containerElement.clientHeight
      );
      return;
    }

    window.scrollTo(0, document.body.scrollHeight - window.innerHeight);
  }, [virtualizerType]);

  useEffect(() => {
    if (!follow) return;

    const timeout = setTimeout(() => {
      scrollToBottom();
    });
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs]);

  const onScroll = useCallback(() => {
    // This is to prevent follow from being broken on initial load
    if (!scrolledOnce) {
      setScrolledOnce(true);
      return;
    }

    const scrollY =
      virtualizerType === "div"
        ? listRef.current?.scrollOffset
        : window.scrollY;
    if (scrollY === undefined) return;

    const elementHeight =
      virtualizerType === "div"
        ? containerRef.current?.clientHeight
        : window.innerHeight;
    if (elementHeight === undefined) return;

    const scrollHeight =
      virtualizerType === "div"
        ? listRef.current?.scrollSize
        : document.body.scrollHeight;
    if (scrollHeight === undefined) return;

    const maxScroll = scrollHeight - elementHeight;
    const distanceToBottom = maxScroll - scrollY;
    const isAtBottom = distanceToBottom < SCROLL_THRESHOLD;
    const isAtTop = scrollY < SCROLL_THRESHOLD;

    // If the user scrolls up, stop following and early return
    if (prevScrollY.current !== null && scrollY < prevScrollY.current) {
      setFollow(false);
    }

    prevScrollY.current = scrollY;

    if (isAtBottom) {
      setIsAtBottom(true);
    } else {
      setIsAtBottom(false);
    }

    if (isAtTop) {
      setIsAtTop(true);
    } else {
      setIsAtTop(false);
    }

    if (!isAtBottom) return false;
    setFollow(true);
  }, [virtualizerType, scrolledOnce]);

  const throttledOnScroll = useThrottledCallback(onScroll, 50);

  if (virtualizerType === "div") {
    return (
      <VirtualListDiv
        onScroll={throttledOnScroll}
        isAtBottom={isAtBottom}
        isAtTop={isAtTop}
        scrollToBottom={scrollToBottom}
        scrollToTop={scrollToTop}
        containerRef={containerRef}
        listRef={listRef}
      >
        {logs.map((logLine, index) => (
          <LogLine
            isFirst={index === 0}
            isLast={index === logs.length - 1}
            key={index}
            logLine={logLine}
          />
        ))}
      </VirtualListDiv>
    );
  }

  return (
    <VirtualListWindow
      onScroll={throttledOnScroll}
      isAtBottom={isAtBottom}
      isAtTop={isAtTop}
      scrollToBottom={scrollToBottom}
      scrollToTop={scrollToTop}
    >
      {logs.map((logLine, index) => (
        <LogLine
          isFirst={index === 0}
          isLast={index === logs.length - 1}
          key={index}
          logLine={logLine}
        />
      ))}
    </VirtualListWindow>
  );
}

function VirtualListDiv({
  onScroll,
  containerRef,
  listRef,
  isAtBottom,
  isAtTop,
  scrollToBottom,
  scrollToTop,
  children,
}: {
  onScroll: () => void;
  containerRef: Ref<HTMLDivElement>;
  listRef: Ref<VListHandle> | undefined;
  children: ReactNode;
} & ButtonsSectionProps) {
  return (
    <div
      ref={containerRef}
      className="w-full flex flex-col flex-1 min-h-0 font-mono overflow-auto"
    >
      <VList ref={listRef} onScroll={onScroll}>
        {children}
      </VList>
      <ButtonsSection
        className="hidden sm:flex sm:absolute right-3 sm:right-4"
        isAtBottom={isAtBottom}
        isAtTop={isAtTop}
        scrollToBottom={scrollToBottom}
        scrollToTop={scrollToTop}
      />
    </div>
  );
}

function VirtualListWindow({
  onScroll,
  isAtBottom,
  isAtTop,
  scrollToBottom,
  scrollToTop,
  children,
}: {
  onScroll: () => void;
  children: ReactNode;
} & ButtonsSectionProps) {
  useEventListener("scroll", onScroll);
  return (
    <div className="w-full flex flex-col font-mono">
      <WindowVirtualizer>{children}</WindowVirtualizer>
      <ButtonsSection
        isAtBottom={isAtBottom}
        isAtTop={isAtTop}
        scrollToBottom={scrollToBottom}
        scrollToTop={scrollToTop}
        className="hidden sm:flex right-3 sm:right-4 bottom-[calc(7rem+var(--safe-area-inset-bottom))] sm:bottom-[calc(1rem+var(--safe-area-inset-bottom))]"
      />
    </div>
  );
}

type ButtonsSectionProps = {
  isAtBottom: boolean;
  isAtTop: boolean;
  scrollToBottom: () => void;
  scrollToTop: () => void;
};

function ButtonsSection({
  isAtBottom,
  isAtTop,
  scrollToBottom,
  scrollToTop,
  className,
}: { className?: string } & ButtonsSectionProps) {
  return (
    <div
      className={cn(
        "fixed flex flex-col right-4 bottom-[calc(1rem+var(--safe-area-inset-bottom))]",
        className
      )}
    >
      <Button
        disabled={isAtTop}
        data-disabled={isAtTop ? true : undefined}
        fadeOnDisabled={false}
        variant="ghost"
        size="icon"
        onClick={scrollToTop}
        className="rounded-lg rounded-b-none bg-background-hover border-t border-l border-r data-[disabled]:text-muted-more-foreground"
      >
        <ArrowUpIcon className="size-5" />
      </Button>
      <div className="w-full h-px bg-border pointer-events-none" />
      <Button
        disabled={isAtBottom}
        data-disabled={isAtBottom ? true : undefined}
        fadeOnDisabled={false}
        variant="ghost"
        size="icon"
        onClick={scrollToBottom}
        className="rounded-lg rounded-t-none bg-background-hover border-b border-l border-r data-[disabled]:text-muted-more-foreground"
      >
        <ArrowDownIcon className="size-5" />
      </Button>
    </div>
  );
}

function LogLine({
  logLine,
  isFirst,
  isLast,
  ...rest
}: {
  logLine: TLogLine;
  isFirst?: boolean;
  isLast?: boolean;
} & ComponentProps<"div">) {
  return (
    <div
      {...rest}
      suppressHydrationWarning
      data-first={isFirst ? true : undefined}
      data-last={isLast ? true : undefined}
      data-level={logLine.level}
      className="w-full flex items-stretch text-xs group/line py-px 
      data-[first]:pt-2 data-[last]:pb-[calc(1rem)]
      sm:data-[first]:pt-3 sm:data-[last]:pb-[calc(1.5rem+var(--safe-area-inset-bottom))] md:data-[first]:pt-4
      data-[last]:animate-in data-[last]:fade-in data-[last]:transition-opacity data-[last]:duration-150"
    >
      <div className="px-3 sm:px-4 md:px-5.5 py-1 w-full flex items-stretch bg-transparent group-data-[level=warn]/line:bg-warning/10 group-data-[level=error]/line:bg-destructive/10">
        <div className="self-stretch flex pr-1.5 shrink-0">
          <div
            className="self-stretch w-1 rounded-full bg-muted-more-foreground group-data-[level=warn]/line:bg-warning 
            group-data-[level=error]/line:bg-destructive"
          />
        </div>
        <div className="flex-1 min-w-0 flex flex-col sm:flex-row gap-0.5 py-0.5 sm:py-0.25">
          <p
            suppressHydrationWarning
            className="shrink font-mono text-muted-foreground px-1 min-w-[calc(min(50%,9rem))] leading-tight"
          >
            {fnsFormat(logLine.timestamp, "MMM dd, HH:mm:ss")}
          </p>
          <p
            suppressHydrationWarning
            className="leading-tight px-1 shrink-[2] min-w-0"
          >
            {logLine.message}
          </p>
        </div>
      </div>
    </div>
  );
}
