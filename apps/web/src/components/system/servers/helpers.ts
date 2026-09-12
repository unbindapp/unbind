import { TServer, TServerDetail } from "@/lib/queries/servers";

export type TServerStatus =
  "not-ready" | "disk-pressure" | "memory-pressure" | "pid-pressure" | "unschedulable" | "ready";

export const serverStatusTitles: Record<TServerStatus, string> = {
  "not-ready": "Not ready",
  "disk-pressure": "Disk pressure",
  "memory-pressure": "Memory pressure",
  "pid-pressure": "PID pressure",
  unschedulable: "Unschedulable",
  ready: "Ready",
};

// Only the worst problem is shown, the rest live in the panel's details tab
export function getServerStatus(server: TServer | TServerDetail): TServerStatus {
  if (!server.ready) return "not-ready";
  if (server.disk_pressure) return "disk-pressure";
  if (server.memory_pressure) return "memory-pressure";
  if (server.pid_pressure) return "pid-pressure";
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
