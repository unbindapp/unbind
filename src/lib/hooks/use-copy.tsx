"use client";

import { useState } from "react";
import { useCopyToClipboard as useCopyToClipboardPrimitive } from "usehooks-ts";

type Props = {
  recentMs: number;
};

export function useCopyToClipboard(props?: Props) {
  const recentMs = props?.recentMs ?? 1500;
  const [copiedText, copyToClipboard] = useCopyToClipboardPrimitive();
  const [isRecentlyCopied, setIsRecentlyCopied] = useState(false);
  const [currentTimeout, setCurrentTimeout] = useState<NodeJS.Timeout | null>(
    null
  );

  function copy(text: string) {
    copyToClipboard(text);
    setIsRecentlyCopied(true);
    if (currentTimeout) {
      clearTimeout(currentTimeout);
    }
    setCurrentTimeout(
      setTimeout(() => {
        setIsRecentlyCopied(false);
      }, recentMs)
    );
  }

  return {
    copiedText,
    copyToClipboard: copy,
    isRecentlyCopied,
  };
}
