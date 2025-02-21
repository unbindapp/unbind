"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/components/ui/utils";
import { format as fnsFormat } from "date-fns";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  FilterIcon,
  SearchIcon,
  SettingsIcon,
} from "lucide-react";
import {
  ComponentProps,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useThrottledCallback } from "use-debounce";
import { VList, VListHandle } from "virtua";

export type TLogLine = {
  level: "info" | "warn" | "error";
  timestamp: number;
  message: string;
  deploymentId: string;
  serviceId: string;
};

type Props = {
  logs: TLogLine[];
  containerType: "page" | "sheet";
  className?: string;
};

const SCROLL_THRESHOLD = 50;

export default function Logs({ logs, containerType }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<VListHandle>(null);
  const follow = useRef(true);
  const prevScrollY = useRef<number | null>(null);
  const scrolledOnce = useRef(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [isAtTop, setIsAtTop] = useState(false);

  const scrollToTop = useCallback(() => {
    follow.current = false;

    const listElement = listRef.current;
    if (!listElement) return;
    listElement.scrollTo(0);
    return;
  }, []);

  const scrollToBottom = useCallback(() => {
    follow.current = true;

    const listElement = listRef.current;
    const containerElement = containerRef.current;
    if (!listElement || !containerElement) return;
    listElement.scrollTo(
      listElement.scrollSize - containerElement.clientHeight
    );
  }, []);

  useEffect(() => {
    if (!follow.current) return;

    const timeout = setTimeout(() => {
      scrollToBottom();
    });
    return () => clearTimeout(timeout);
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
          data-container={containerType}
          data-first={index === 0 ? true : undefined}
          data-last={index === logs.length - 1 ? true : undefined}
          key={index}
          logLine={logLine}
          className="data-[container=page]:data-[last]:pb-4 sm:data-[container=page]:data-[last]:pb-[calc(1.5rem+var(--safe-area-inset-bottom))]
          data-[container=sheet]:data-[last]:pb-[calc(1rem+var(--safe-area-inset-bottom))] sm:data-[container=sheet]:data-[last]:pb-[calc(1.5rem+var(--safe-area-inset-bottom))]"
        />
      )),
    [logs, containerType]
  );

  return (
    <div className="w-full flex flex-col flex-1 min-h-0 overflow-hidden relative">
      <div className="w-full flex items-stretch gap-2 px-2 pt-2 sm:px-2.5 sm:pt-2.5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            toast.success("Search", {
              description: "This is fake",
              duration: 2000,
              closeButton: false,
            });
          }}
          className="flex-1 flex items-stretch relative"
        >
          <SearchIcon className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            className="flex-1 py-2.25 pl-8.5 pr-22"
            placeholder="Search logs..."
          />
          <div className="absolute flex justify-end right-0 top-0 h-full">
            <Button
              aria-label="Filter Logs"
              onClick={() => {
                toast.success("Filter", {
                  description: "This is fake",
                  duration: 2000,
                  closeButton: false,
                });
              }}
              type="button"
              size="icon"
              variant="ghost"
              className="h-auto border-l rounded-none w-10"
            >
              <FilterIcon className="size-5" />
            </Button>
            <Button
              aria-label="Log Settings"
              onClick={() => {
                toast.success("Settings", {
                  description: "This is fake",
                  duration: 2000,
                  closeButton: false,
                });
              }}
              type="button"
              size="icon"
              variant="ghost"
              className="h-auto text-foreground w-10 rounded-l-none rounded-r-lg border-l"
            >
              <SettingsIcon className="size-5" />
            </Button>
          </div>
        </form>
      </div>
      <div
        ref={containerRef}
        className="w-full flex flex-col flex-1 min-h-0 overflow-hidden relative"
        style={{
          maskImage: "linear-gradient(to bottom, transparent, black 0.75rem)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent, black 0.75rem)",
        }}
      >
        <VList
          style={{ height: undefined }}
          className="w-full flex-1 min-h-0 font-mono"
          ref={listRef}
          onScroll={throttledOnScroll}
        >
          {elements}
        </VList>
        <ButtonsSection
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
  ...rest
}: { className?: string } & ButtonsSectionProps) {
  return (
    <div
      {...rest}
      className={cn(
        "absolute flex flex-col right-4 bottom-[calc(1rem+var(--safe-area-inset-bottom))]",
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
  className,
  ...rest
}: {
  logLine: TLogLine;
} & ComponentProps<"div">) {
  return (
    <div
      {...rest}
      suppressHydrationWarning
      data-level={logLine.level}
      className={cn(
        `w-full flex items-stretch text-xs group/line py-px 
        data-[first]:pt-3
        data-[last]:pb-[calc(1rem+var(--safe-area-inset-bottom))] sm:data-[last]:pb-[calc(1.5rem+var(--safe-area-inset-bottom))]`,
        className
      )}
    >
      <div className="px-3 sm:px-4 py-1 w-full flex items-stretch bg-transparent group-data-[level=warn]/line:bg-warning/10 group-data-[level=error]/line:bg-destructive/10">
        <div className="self-stretch flex pr-1.5 shrink-0">
          <div
            className="self-stretch w-0.75 rounded-full bg-muted-more-foreground/50 group-data-[level=warn]/line:bg-warning 
            group-data-[level=error]/line:bg-destructive"
          />
        </div>
        <div className="flex-1 min-w-0 flex flex-col sm:flex-row gap-0.5 py-0.5 sm:py-0.5">
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
