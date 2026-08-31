import { TDeploymentShallow } from "@/lib/queries/deployments";

// Loki ingestion lags briefly, so a deployment that just finished can still be
// missing its final logs even though nothing is running anymore.
const lokiLagGraceMs = 2 * 60 * 1000;

function isWithinLokiLagGrace(deployment: TDeploymentShallow): boolean {
  const referenceTime = deployment.completed_at ?? deployment.created_at;
  if (!referenceTime) return false;
  return Date.now() - new Date(referenceTime).getTime() < lokiLagGraceMs;
}

export function expectsBuildLogs(deployment: TDeploymentShallow): boolean {
  const { status } = deployment;
  if (status === "build-queued" || status === "build-pending" || status === "build-running") {
    return true;
  }
  if (status === "build-cancelled" || status === "removed") return false;
  return isWithinLokiLagGrace(deployment);
}

export function expectsDeployLogs(deployment: TDeploymentShallow): boolean {
  const { status } = deployment;
  if (status === "build-cancelled" || status === "build-failed" || status === "removed") {
    return false;
  }
  if (
    status === "build-queued" ||
    status === "build-pending" ||
    status === "build-running" ||
    status === "build-succeeded" ||
    status === "launching"
  ) {
    return true;
  }
  return isWithinLokiLagGrace(deployment);
}
