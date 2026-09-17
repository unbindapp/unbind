const DEFAULT_SETTLE_FRAMES = 8;

// Content is measured as it renders, so a single scroll lands where the
// estimates said the target was. Repeating it over a few frames follows the
// measurements in; a scroll of the user's own cuts it short. The step reports
// false once there is nothing left to scroll to. onEnd runs once, however the
// settling stopped.
export function settleScroll(
  scrollElement: HTMLDivElement | null,
  step: () => boolean,
  { maxFrames = DEFAULT_SETTLE_FRAMES, onEnd }: { maxFrames?: number; onEnd?: () => void } = {},
) {
  let cancelled = false;
  const cancel = () => {
    cancelled = true;
  };
  scrollElement?.addEventListener("wheel", cancel, { passive: true });
  scrollElement?.addEventListener("touchstart", cancel, { passive: true });
  let ended = false;
  const cleanup = () => {
    cancelled = true;
    scrollElement?.removeEventListener("wheel", cancel);
    scrollElement?.removeEventListener("touchstart", cancel);
    if (ended) return;
    ended = true;
    onEnd?.();
  };

  if (!step()) {
    cleanup();
    return cleanup;
  }
  let frames = 0;
  const settle = () => {
    if (cancelled || !step()) return cleanup();
    frames++;
    if (frames < maxFrames) {
      requestAnimationFrame(settle);
      return;
    }
    cleanup();
  };
  requestAnimationFrame(settle);
  return cleanup;
}
