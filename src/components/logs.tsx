import { useWindowVirtualizer } from "@tanstack/react-virtual";
import {
  ComponentProps,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useThrottledCallback } from "use-debounce";
import { useEventListener } from "usehooks-ts";
import { format as fnsFormat } from "date-fns";

export type TLogLine = {
  level: "info" | "warn" | "error";
  timestamp: number;
  message: string;
  deploymentId: string;
  serviceId: string;
};

type Props = {
  logs: TLogLine[];
  className?: string;
};

const FOLLOW_THRESHOLD = 50;

export default function Logs({ logs }: Props) {
  const documentRef = useRef(document);
  const containerRef = useRef<HTMLDivElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useWindowVirtualizer({
    count: logs.length,
    estimateSize: () => 45,
  });
  const virtualItems = virtualizer.getVirtualItems();
  const [follow, setFollow] = useState(true);

  useEffect(() => {
    if (!follow) return;
    virtualizer.scrollToOffset(virtualizer.getTotalSize());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs]);

  const onWheel = useCallback(() => {
    setFollow(false);

    const fullSize = document.body.scrollHeight;
    const maxScroll = fullSize - window.innerHeight;
    const scrollOffset = virtualizer.scrollOffset || 0;
    const distanceToBottom = maxScroll - scrollOffset;
    const isAtBottom = distanceToBottom < FOLLOW_THRESHOLD;

    if (!isAtBottom) {
      setFollow(false);
      return;
    }
    if (isAtBottom) {
      setFollow(true);
      virtualizer.scrollToOffset(fullSize);
      return;
    }
  }, [virtualizer]);

  const throttledOnWheel = useThrottledCallback(onWheel, 50);

  useEventListener("scroll", throttledOnWheel, documentRef, {
    passive: true,
  });

  return (
    <div ref={containerRef} className="w-full flex flex-col font-mono">
      <div ref={parentRef} className="w-full overflow-auto">
        <div
          style={{
            height: virtualizer.getTotalSize(),
          }}
          className="w-full relative"
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${virtualItems[0]?.start ?? 0}px)`,
            }}
          >
            {virtualItems.map((virtualItem) => (
              <LogLine
                isFirst={virtualItem.index === 0}
                isLast={virtualItem.index === logs.length - 1}
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                logLine={logs[virtualItem.index]}
              />
            ))}
          </div>
        </div>
      </div>
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
      data-is-first={isFirst ? true : undefined}
      data-is-last={isLast ? true : undefined}
      data-level={logLine.level}
      className="w-full flex items-stretch text-xs group/line py-px 
      data-[is-first]:pt-2 data-[is-last]:pb-[calc(1rem)]
      sm:data-[is-first]:pt-3 sm:data-[is-last]:pb-[calc(1.5rem+var(--safe-area-inset-bottom))]
      md:data-[is-first]:pt-4"
    >
      <div className="px-3 sm:px-4 md:px-5.5 py-1 w-full flex items-stretch bg-transparent group-data-[level=warn]/line:bg-warning/10 group-data-[level=error]/line:bg-destructive/10">
        <div className="self-stretch flex pr-1.5 shrink-0">
          <div
            className="self-stretch w-1 rounded-full bg-foreground/50 group-data-[level=warn]/line:bg-warning 
            group-data-[level=error]/line:bg-destructive"
          />
        </div>
        <div className="flex-1 flex flex-col sm:flex-row gap-0.5">
          <p className="font-mono text-muted-foreground px-1 min-w-38 leading-tight">
            {fnsFormat(logLine.timestamp, "MMM dd, HH:mm:ss")}
          </p>
          <p className="leading-tight px-1">{logLine.message}</p>
        </div>
      </div>
    </div>
  );
}
