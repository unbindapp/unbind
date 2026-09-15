import type { PermittedAction, ResourceType } from "@/lib/server/client.gen";
import type { TApiKeyShallow } from "@/lib/queries/api-keys";
import { addDays } from "date-fns";
import { EyeIcon, ShieldHalfIcon, SquarePenIcon } from "lucide-react";
import type { FC } from "react";

export const roleOptions: {
  value: PermittedAction;
  title: string;
  description: string;
  Icon: FC<{ className?: string }>;
}[] = [
  {
    value: "viewer",
    title: "Viewer",
    description: "Can read config, logs, and metrics. Variables are hidden.",
    Icon: EyeIcon,
  },
  {
    value: "editor",
    title: "Editor",
    description: "Can also deploy, change settings, and read variables.",
    Icon: SquarePenIcon,
  },
  {
    value: "admin",
    title: "Admin",
    description: "Can also delete and manage access.",
    Icon: ShieldHalfIcon,
  },
];

const roleRank: Record<PermittedAction, number> = { viewer: 1, editor: 2, admin: 3 };

export function strongestRole(actions: PermittedAction[] | undefined): PermittedAction | null {
  if (!actions || actions.length === 0) return null;
  return actions.reduce((best, action) => (roleRank[action] > roleRank[best] ? action : best));
}

export function roleAllowedBy(role: PermittedAction, cap: PermittedAction | null) {
  if (cap === null) return false;
  return roleRank[role] <= roleRank[cap];
}

export const expiryOptions = [
  { value: "1d", label: "1 day", days: 1 },
  { value: "7d", label: "7 days", days: 7 },
  { value: "30d", label: "30 days", days: 30 },
  { value: "90d", label: "90 days", days: 90 },
  { value: "1y", label: "1 year", days: 365 },
  { value: "never", label: "Never", days: null },
] as const;

export type TExpiryValue = (typeof expiryOptions)[number]["value"];
export const defaultExpiry: TExpiryValue = "90d";

export function expiresAtFrom(value: TExpiryValue): string | undefined {
  const option = expiryOptions.find((o) => o.value === value);
  if (!option || option.days === null) return undefined;
  return addDays(new Date(), option.days).toISOString();
}

// One picker row. "*" at a level means "all of them", which stops the cascade there.
export const allValue = "*";

export type TResourceRow = {
  teamId: string;
  projectId: string;
  environmentId: string;
  serviceId: string;
};

export const emptyResourceRow: TResourceRow = {
  teamId: "",
  projectId: allValue,
  environmentId: allValue,
  serviceId: allValue,
};

export function rowToResource(
  row: TResourceRow,
): { resource_type: ResourceType; resource_id: string } | null {
  if (!row.teamId) return null;
  if (row.serviceId !== allValue) return { resource_type: "service", resource_id: row.serviceId };
  if (row.environmentId !== allValue)
    return { resource_type: "environment", resource_id: row.environmentId };
  if (row.projectId !== allValue) return { resource_type: "project", resource_id: row.projectId };
  return { resource_type: "team", resource_id: row.teamId };
}

export const pathSeparator = " › ";

export function describeResource(resource: TApiKeyShallow["resources"][number]) {
  if (resource.path.length === 0) return `Deleted ${resource.resource_type}`;
  return resource.path.join(pathSeparator);
}
