"use client";

import { format as fnsFormat } from "date-fns";
import { ComponentProps, useCallback, useEffect, useState } from "react";
import { useThrottledCallback } from "use-debounce";
import { useEventListener } from "usehooks-ts";
import { WindowVirtualizer } from "virtua";

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
  const [follow, setFollow] = useState(true);
  const [followLocked, setFollowLocked] = useState(false);

  useEffect(() => {
    if (!follow) return;
    if (followLocked) return;

    const timeout = setTimeout(() =>
      window.scrollTo(0, document.body.scrollHeight - window.innerHeight)
    );
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs]);

  const onScroll = useCallback(() => {
    setFollowLocked(true);
    setFollow(false);

    const maxScroll = document.body.scrollHeight - window.innerHeight;
    const distanceToBottom = maxScroll - window.scrollY;
    const isAtBottom = distanceToBottom < FOLLOW_THRESHOLD;

    if (!isAtBottom) {
      setFollow(false);
      setFollowLocked(false);
      return;
    }

    if (isAtBottom) {
      setFollow(true);
      setFollowLocked(false);
      return;
    }
  }, []);

  const throttledOnScroll = useThrottledCallback(onScroll, 50);

  useEventListener("scroll", throttledOnScroll);

  return (
    <div className="w-full flex flex-col font-mono">
      <WindowVirtualizer>
        {logs.map((logLine, index) => (
          <LogLine
            isFirst={index === 0}
            isLast={index === logs.length - 1}
            key={index}
            logLine={logLine}
          />
        ))}
      </WindowVirtualizer>
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
      data-is-first={isFirst ? true : undefined}
      data-is-last={isLast ? true : undefined}
      data-level={logLine.level}
      className="w-full flex items-stretch text-xs group/line py-px 
      data-[is-first]:pt-2 data-[is-last]:pb-[calc(1rem)]
      sm:data-[is-first]:pt-3 sm:data-[is-last]:pb-[calc(1.5rem+var(--safe-area-inset-bottom))]
      md:data-[is-first]:pt-4
      data-[is-last]:animate-in data-[is-last]:fade-in data-[is-last]:transition-opacity data-[is-last]:duration-300"
    >
      <div className="px-3 sm:px-4 md:px-5.5 py-1 w-full flex items-stretch bg-transparent group-data-[level=warn]/line:bg-warning/10 group-data-[level=error]/line:bg-destructive/10">
        <div className="self-stretch flex pr-1.5 shrink-0">
          <div
            className="self-stretch w-1 rounded-full bg-foreground/50 group-data-[level=warn]/line:bg-warning 
            group-data-[level=error]/line:bg-destructive"
          />
        </div>
        <div className="flex-1 min-w-0 flex flex-col sm:flex-row gap-0.5">
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
