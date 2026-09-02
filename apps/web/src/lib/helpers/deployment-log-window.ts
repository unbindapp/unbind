import type { TDeploymentShallow } from "@/lib/queries/deployments";
import { lokiLagGraceMs } from "./deployment-expects-logs.ts";

export type TLogsWindow = {
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

// Both ends carry the ingestion grace: the first lines can predate the row's
// timestamp slightly, and the last ones land shortly after the run is over.
export function deployLogsWindow(deployment: TDeploymentShallow, now: number): TLogsWindow {
  const reference = deployment.started_at ?? deployment.queued_at ?? deployment.created_at;
  const start = new Date(reference).getTime() - lokiLagGraceMs;
  if (!deployLogsAreFinal(deployment.status)) return { start };
  // updated_at is the last write, which for a final status is when it landed
  return settleWindow(start, new Date(deployment.updated_at).getTime() + lokiLagGraceMs, now);
}

export function buildLogsWindow(deployment: TDeploymentShallow, now: number): TLogsWindow {
  const start = new Date(deployment.created_at).getTime() - lokiLagGraceMs;
  if (!deployment.completed_at) return { start };
  return settleWindow(start, new Date(deployment.completed_at).getTime() + lokiLagGraceMs, now);
}

function settleWindow(start: number, end: number, now: number): TLogsWindow {
  if (now < end) return { start, liveUntil: end };
  return { start, end };
}
