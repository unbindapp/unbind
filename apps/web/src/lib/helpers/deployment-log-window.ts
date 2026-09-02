import type { TDeploymentShallow } from "@/lib/queries/deployments";
import { lokiLagGraceMs } from "./deployment-expects-logs.ts";

const hourInMs = 60 * 60 * 1000;

export type TDeployLogsWindow = {
  start: number;
  /** Set once nothing can be logged anymore, pinning the window so no live tail is opened. */
  end?: number;
  /** While set, the window is still live and should be re-evaluated at this moment. */
  liveUntil?: number;
};

// A failed or cancelled build never produced a pod; a removed deployment's pod is gone.
export function deployLogsAreFinal(status: TDeploymentShallow["status"]): boolean {
  return status === "removed" || status === "build-failed" || status === "build-cancelled";
}

export function deployLogsWindow(deployment: TDeploymentShallow, now: number): TDeployLogsWindow {
  const reference = deployment.started_at ?? deployment.queued_at ?? deployment.created_at;
  const start = new Date(reference).getTime() - hourInMs;
  if (!deployLogsAreFinal(deployment.status)) return { start };
  // updated_at is the last write, which for a final status is when it landed
  const liveUntil = new Date(deployment.updated_at).getTime() + lokiLagGraceMs;
  if (now < liveUntil) return { start, liveUntil };
  return { start, end: now };
}
