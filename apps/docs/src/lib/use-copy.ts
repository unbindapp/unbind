import { useRef, useState } from "react";

export function useCopyToClipboard(recentMs = 1500) {
  const [isRecentlyCopied, setIsRecentlyCopied] = useState(false);
  const timeout = useRef<number>(undefined);

  function markCopied() {
    setIsRecentlyCopied(true);
    window.clearTimeout(timeout.current);
    timeout.current = window.setTimeout(() => setIsRecentlyCopied(false), recentMs);
  }

  function copyToClipboard(text: string) {
    void navigator.clipboard.writeText(text);
    markCopied();
  }

  return { copyToClipboard, markCopied, isRecentlyCopied };
}
