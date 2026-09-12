import {
  TServer,
  TServerCondition,
  TServerConditionType,
  TServerDetail,
} from "@/lib/queries/servers";

export type TServerStatus = "not-ready" | "unschedulable" | "ready" | TServerConditionType;

export const serverStatusTitles: Record<TServerStatus, string> = {
  "not-ready": "Not ready",
  disk: "Low disk space",
  memory: "Low memory",
  processes: "Too many processes",
  network: "No network",
  unschedulable: "Unschedulable",
  ready: "Ready",
};

// What each condition is called and what it says when healthy or not
export const serverConditionTitles: Record<TServerConditionType, string> = {
  memory: "Memory",
  disk: "Disk",
  processes: "Processes",
  network: "Network",
};

export const serverConditionTexts: Record<
  TServerConditionType,
  Record<TServerCondition["status"], string>
> = {
  memory: { healthy: "Sufficient", unhealthy: "Running out", unknown: "Unknown" },
  disk: { healthy: "Sufficient", unhealthy: "Running out", unknown: "Unknown" },
  processes: { healthy: "Sufficient", unhealthy: "Too many", unknown: "Unknown" },
  network: { healthy: "Available", unhealthy: "Unavailable", unknown: "Unknown" },
};

// Worst first, so a server short on disk doesn't advertise itself as merely unschedulable
const conditionSeverity: TServerConditionType[] = ["disk", "memory", "processes", "network"];

// Only the worst problem is shown on the card, every condition lives in the panel
export function getServerStatus(server: TServer | TServerDetail): TServerStatus {
  if (!server.ready) return "not-ready";

  for (const type of conditionSeverity) {
    const condition = server.conditions.find((c) => c.type === type);
    if (condition?.status === "unhealthy") return type;
  }

  if (server.unschedulable) return "unschedulable";
  return "ready";
}

export function getServerStatusLevel(status: TServerStatus): "error" | "warning" | "success" {
  if (status === "ready") return "success";
  if (status === "unschedulable") return "warning";
  return "error";
}

type TUsageLevel = "normal" | "high" | "critical" | "unknown";

export function getUsageLevel({ used, total }: { used: number; total: number }): TUsageLevel {
  if (total <= 0) return "unknown";
  const usage = used / total;
  if (usage >= 0.9) return "critical";
  if (usage >= 0.75) return "high";
  return "normal";
}

export function getUsagePercentage({ used, total }: { used: number; total: number }): number {
  if (total <= 0) return 0;
  return Math.min(Math.max(0, (used / total) * 100), 100);
}
