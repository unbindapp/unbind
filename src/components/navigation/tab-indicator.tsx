"use client";

import { cn } from "@/components/ui/utils";
import { useWindowSize } from "@uidotdev/usehooks";
import { RefObject, useCallback, useEffect, useState } from "react";

type Props = {
  activeTabIndex: number;
  refs: RefObject<HTMLAnchorElement | HTMLButtonElement | null>[];
  className?: string;
};

export default function TabIndicator({
  activeTabIndex,
  refs,
  className,
}: Props) {
  const [widths, setWidths] = useState<number[] | null>(null);
  const translateX =
    widths && widths.every((width) => width) && activeTabIndex >= 0
      ? widths.slice(0, activeTabIndex).reduce((acc, width) => acc + width, 0)
      : 0;
  const width =
    widths && activeTabIndex >= 0 && activeTabIndex < widths.length
      ? widths[activeTabIndex]
      : 0;
  const { width: windowWidth } = useWindowSize();

  const calculateAndSetWidths = useCallback(() => {
    const hasAllRefs = refs.every((ref) => ref?.current?.clientWidth);
    if (!hasAllRefs) return;
    const newWidths = refs.map((ref) => ref?.current?.clientWidth ?? 0);
    setWidths(newWidths);
  }, []);

  useEffect(() => {
    calculateAndSetWidths();
  }, []);

  useEffect(() => {
    calculateAndSetWidths();
  }, [windowWidth]);

  return (
    <div
      style={{
        width,
        transform: `translateX(${translateX}px)`,
      }}
      className={cn(
        "transition-all origin-left h-2px absolute left-0 bottom-0 bg-foreground rounded-full",
        className
      )}
    />
  );
}
