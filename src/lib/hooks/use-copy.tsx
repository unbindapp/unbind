"use client";

import { useRef, useState } from "react";
import { useCopyToClipboard as useCopyToClipboardPrimitive } from "usehooks-ts";

type TProps = {
  recentMs: number;
};

export function useCopyToClipboard(props?: TProps) {
  const recentMs = props?.recentMs ?? 1500;
  const [copiedText, copyToClipboard] = useCopyToClipboardPrimitive();
  const [isRecentlyCopied, setIsRecentlyCopied] = useState(false);
  const currentTimeout = useRef<NodeJS.Timeout | null>(null);

  function copy(text: string) {
    copyToClipboard(text);
    setIsRecentlyCopied(true);
    if (currentTimeout?.current) {
      clearTimeout(currentTimeout.current);
    }
    currentTimeout.current = setTimeout(() => {
      setIsRecentlyCopied(false);
    }, recentMs);
  }

  return {
    copiedText,
    copyToClipboard: copy,
    isRecentlyCopied,
  };
}
