import type { TApiKeyShallow } from "@/lib/queries/api-keys";
import type { KeyCapability, PermittedAction, ResourceType } from "@/lib/server/client.gen";
import { addDays } from "date-fns";
import {
  EyeIcon,
  KeyRoundIcon,
  ListFilterIcon,
  LogsIcon,
  ScrollTextIcon,
  ShieldHalfIcon,
  SquarePenIcon,
  WebhookIcon,
} from "lucide-react";
import { useCallback, useState, type FC } from "react";
import { z } from "zod";

export type TAccess = "full" | "scoped";

export const accessOptions: {
  value: TAccess;
  label: string;
  description: string;
  Icon: FC<{ className?: string }>;
}[] = [
  {
    value: "full",
    label: "Everything I can access",
    description: "Follows your own permissions.",
    Icon: ScrollTextIcon,
  },
  {
    value: "scoped",
    label: "Only specific resources",
    description: "Pick a team, project, environment or service.",
    Icon: ListFilterIcon,
  },
];

export const roleOptions: {
  value: PermittedAction;
  title: string;
  description: string;
  Icon: FC<{ className?: string }>;
}[] = [
  {
    value: "viewer",
    title: "Viewer",
    description: "Can read config, metrics, and deployments.",
    Icon: EyeIcon,
  },
  {
    value: "editor",
    title: "Editor",
    description: "Can also deploy, change settings, and variables.",
    Icon: SquarePenIcon,
  },
  {
    value: "admin",
    title: "Admin",
    description: "Can also delete and manage access.",
    Icon: ShieldHalfIcon,
  },
];

export const capabilityOptions: {
  value: KeyCapability;
  title: string;
  Icon: FC<{ className?: string }>;
}[] = [
  { value: "read_variable_values", title: "Read variable values", Icon: KeyRoundIcon },
  { value: "read_logs", title: "Read logs", Icon: LogsIcon },
  { value: "read_webhook_urls", title: "Read webhook URLs", Icon: WebhookIcon },
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

// Access, rows and role share the picker's column width
export const accessFieldClassName = "mt-3 w-full lg:w-[calc((100%-0.5rem)/2)]";

export const accessFormShape = {
  access: z.enum(["full", "scoped"]),
  rows: z.array(
    z.object({
      teamId: z.string(),
      projectId: z.string(),
      environmentId: z.string(),
      serviceId: z.string(),
    }),
  ),
  role: z.enum(["viewer", "editor", "admin"]),
  capabilities: z.array(z.enum(["read_variable_values", "read_logs", "read_webhook_urls"])),
};

export function hasPickedResource(value: { access: TAccess; rows: TResourceRow[] }) {
  return value.access === "full" || value.rows.some((row) => row.teamId !== "");
}

export const pickResourceMessage = { message: "Pick at least one resource.", path: ["rows"] };

export type TResourceCaps = ReturnType<typeof useResourceCaps>;

// Per row, the strongest role the owner holds on its deepest pick
export function useResourceCaps() {
  const [caps, setCaps] = useState<(PermittedAction | null)[]>([null]);
  const setCap = useCallback((index: number, cap: PermittedAction | null) => {
    setCaps((prev) => {
      if (prev[index] === cap) return prev;
      const next = [...prev];
      next[index] = cap;
      return next;
    });
  }, []);
  const remove = useCallback(
    (index: number) => setCaps((prev) => prev.filter((_, i) => i !== index)),
    [],
  );
  const add = useCallback(() => setCaps((prev) => [...prev, null]), []);
  const reset = useCallback(() => setCaps([null]), []);
  return { caps, setCap, remove, add, reset };
}

// The weakest cap across picked rows; undefined until a row is picked, null when a pick grants nothing
export function scopedCapFrom(rows: TResourceRow[], caps: (PermittedAction | null)[]) {
  const pickedCaps = rows.map((row, i) => (row.teamId ? caps[i] : undefined));
  return pickedCaps.reduce<PermittedAction | null | undefined>((weakest, cap) => {
    if (cap === undefined) return weakest;
    if (weakest === undefined) return cap;
    if (weakest === null || cap === null) return null;
    return roleAllowedBy(cap, weakest) ? cap : weakest;
  }, undefined);
}

export function isRoleAllowed(
  access: TAccess,
  scopedCap: PermittedAction | null | undefined,
  role: PermittedAction,
) {
  return access === "full" || scopedCap === undefined || roleAllowedBy(role, scopedCap);
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
