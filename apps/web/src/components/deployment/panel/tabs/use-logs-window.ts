import type { TLogsWindow } from "@/lib/helpers/deployment-log-window";
import type { TDeploymentShallow } from "@/lib/queries/deployments";
import { useEffect, useMemo, useState } from "react";

// "now" lives in state so a pinned end doesn't move with every render.
export function useLogsWindow(
  deployment: TDeploymentShallow,
  compute: (deployment: TDeploymentShallow, now: number) => TLogsWindow,
): TLogsWindow {
  const [now, setNow] = useState(() => Date.now());
  const window = useMemo(() => compute(deployment, now), [compute, deployment, now]);

  const { liveUntil } = window;
  useEffect(() => {
    if (liveUntil === undefined) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, liveUntil - now));
    return () => clearTimeout(timer);
  }, [liveUntil, now]);

  return window;
}
